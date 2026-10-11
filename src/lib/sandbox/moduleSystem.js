/**
 * Browser-hosted CommonJS module loader.
 *
 * The candidate's repository is plain CommonJS JavaScript, so we can execute it for
 * real inside the page: each file is compiled with `new Function` and handed its own
 * `module` / `exports` / `require`, resolved against the virtual file tree.
 */

const EXTENSION_CANDIDATES = ['', '.js', '.jsx', '.json', '/index.js', '/index.jsx'];

export function normalizePath(p) {
  const parts = String(p).replace(/\\/g, '/').split('/');
  const stack = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

export function dirname(p) {
  const n = normalizePath(p);
  const idx = n.lastIndexOf('/');
  return idx === -1 ? '' : n.slice(0, idx);
}

export function resolveRelative(fromDir, request) {
  const joined = request.startsWith('/') ? request.slice(1) : `${fromDir}/${request}`;
  return normalizePath(joined);
}

function matchExtension(base, files) {
  for (const ext of EXTENSION_CANDIDATES) {
    const candidate = normalizePath(base + ext);
    if (Object.prototype.hasOwnProperty.call(files, candidate)) return candidate;
  }
  return null;
}

/**
 * @param {Record<string,string>} files virtual repo: path -> source
 * @param {Record<string, any>} mocks bare-specifier stand-ins ('express', 'jsonwebtoken', ...)
 */
export function createModuleSystem(files, mocks = {}, runtime = {}) {
  const cache = new Map();
  const registry = new Map(Object.entries(mocks));
  const warnings = [];

  function resolveRequest(fromId, request) {
    if (request.startsWith('.')) {
      const base = resolveRelative(dirname(fromId), request);
      const found = matchExtension(base, files);
      if (found) return { kind: 'file', id: found };
      throw new Error(`Cannot find module '${request}' from '${fromId}'`);
    }
    if (registry.has(request)) {
      return { kind: 'mock', id: request };
    }
    if (registry.has(`node:${request}`)) {
      return { kind: 'mock', id: `node:${request}` };
    }
    throw new Error(`Cannot find module '${request}' from '${fromId}'`);
  }

  function requireFrom(fromId) {
    return function scopedRequire(request) {
      const target = resolveRequest(fromId, request);
      if (target.kind === 'mock') return registry.get(target.id);
      return load(target.id);
    };
  }

  function load(id) {
    if (cache.has(id)) return cache.get(id).exports;

    const source = files[id];
    if (source == null) throw new Error(`Cannot find module '${id}'`);

    if (id.endsWith('.json')) {
      const parsed = JSON.parse(source);
      cache.set(id, { exports: parsed });
      return parsed;
    }

    const module = { exports: {}, id, filename: id };
    cache.set(id, module);

    try {
      const factory = new Function(
        'module',
        'exports',
        'require',
        '__filename',
        '__dirname',
        'process',
        'Buffer',
        'console',
        `${source}\n//# sourceURL=capex:///${id}`,
      );
      factory(
        module,
        module.exports,
        requireFrom(id),
        id,
        dirname(id),
        runtime.process ?? createProcessMock(),
        runtime.Buffer ?? { from: (v) => ({ toString: () => String(v) }) },
        runtime.console ?? { log() {}, warn() {}, error() {}, info() {}, debug() {} },
      );
    } catch (err) {
      err.message = `[${id}] ${err.message}`;
      throw err;
    }

    return module.exports;
  }

  /** Load every module ahead of time so import-time crashes surface as suite errors. */
  function preload(ids = Object.keys(files)) {
    for (const id of ids) {
      if (id.endsWith('.json') || id.endsWith('.jsx')) continue;
      if (/\.(test|spec)\.js$/.test(id)) continue;
      try {
        load(id);
      } catch (err) {
        warnings.push({ id, message: err.message });
      }
    }
    return warnings;
  }

  return { load, requireFrom, preload, warnings, registry, setMock: (k, v) => registry.set(k, v) };
}

export function createProcessMock() {
  const queue = [];
  return {
    env: { NODE_ENV: 'test', PORT: '4000' },
    argv: ['node', 'server/index.js'],
    platform: 'linux',
    version: 'v20.11.0',
    cwd: () => '/workspace',
    nextTick: (fn, ...args) => queue.push(() => fn(...args)),
    uptime: () => 8123.42,
    exit: () => {},
    hrtime: { bigint: () => BigInt(0) },
    stdout: { write: () => true },
    stderr: { write: () => true },
  };
}

export const runtimeGlobals = {
  process: createProcessMock(),
  Buffer: {
    from: (v) => ({ toString: () => String(v) }),
    isBuffer: () => false,
  },
};
