/**
 * A faithful-enough Express 4 simulator.
 *
 * Every `use` / `get` / `post` registration is flattened into one ordered layer stack
 * (exactly how Express composes middleware), then `dispatch()` walks that stack with
 * async-aware dispatch — including `next(err)` propagation into 4-arity error handlers.
 * This is what lets the integration suite assert real HTTP semantics (401 vs 403,
 * param routing, async route rejection) against candidate code.
 */

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'all', 'head', 'options'];

export function pathToRegExp(pattern, { end = true } = {}) {
  if (pattern instanceof RegExp) return { re: pattern, keys: [] };
  const keys = [];
  const source = String(pattern)
    .replace(/\/+$/, '')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/:(\w+)/g, (_m, key) => {
      keys.push(key);
      return '([^/]+)';
    })
    .replace(/\*/g, '(.*)');
  return { re: new RegExp(`^${source || ''}${end ? '/?$' : '(?:/|$)'}`), keys };
}

export function matchPath(pattern, pathname) {
  const { re, keys } = pathToRegExp(pattern);
  const m = re.exec(pathname);
  if (!m) return null;
  const params = {};
  keys.forEach((k, i) => {
    params[k] = decodeURIComponent(m[i + 1]);
  });
  return params;
}

/** `app.use('/api/tasks', mw)` matches the mount point *and everything beneath it*. */
export function matchPrefix(pattern, pathname) {
  const { re, keys } = pathToRegExp(pattern, { end: false });
  const m = re.exec(pathname);
  if (!m) return null;
  const params = {};
  keys.forEach((k, i) => {
    params[k] = decodeURIComponent(m[i + 1]);
  });
  return params;
}

function parseQuery(search) {
  const query = {};
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const [k, v] of params.entries()) {
    if (k in query) {
      query[k] = Array.isArray(query[k]) ? [...query[k], v] : [query[k], v];
    } else {
      query[k] = v;
    }
  }
  return query;
}

function createResponse() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader() {
      return this;
    },
    header() {
      return this;
    },
    set() {
      return this;
    },
    type() {
      return this;
    },
    json(payload) {
      this.body = payload;
      this.contentType = 'application/json';
      this._ended = true;
      return this;
    },
    send(payload) {
      this.body = payload;
      this._ended = true;
      return this;
    },
    sendStatus(code) {
      this.statusCode = code;
      this.body = { error: String(code) };
      this._ended = true;
      return this;
    },
    end(payload) {
      if (payload !== undefined) this.body = payload;
      this._ended = true;
      return this;
    },
    redirect(code) {
      this.statusCode = code;
      this._ended = true;
      return this;
    },
    locals: {},
    get headers() {
      return { 'content-type': this.contentType ?? 'application/json' };
    },
  };
}

function normalizeUseArgs(args) {
  const first = args[0];
  const isPrefix = typeof first === 'string' || first instanceof RegExp;
  return {
    prefix: isPrefix ? first : '/',
    handlers: (isPrefix ? args.slice(1) : args).filter((h) => typeof h === 'function'),
  };
}

function createRouter(label) {
  const layers = [];
  const router = function router(_req, _res, next) {
    return next();
  };
  router._layers = layers;
  router._label = label;

  router.use = (...args) => {
    const { prefix, handlers } = normalizeUseArgs(args);
    handlers.forEach((fn) =>
      layers.push({ kind: 'middleware', prefix, fn, isErrorHandler: fn.length >= 4 }),
    );
    return router;
  };

  for (const method of METHODS) {
    router[method] = (path, ...handlers) => {
      layers.push({
        kind: 'route',
        method,
        path,
        handlers: handlers.filter((h) => typeof h === 'function'),
      });
      return router;
    };
  }

  return router;
}

function createApp(label = 'app') {
  const layers = [];
  const app = function app(_req, _res, next) {
    return next();
  };
  app._layers = layers;
  app._label = label;
  app.locals = {};

  app.use = (...args) => {
    const { prefix, handlers } = normalizeUseArgs(args);
    handlers.forEach((fn) =>
      layers.push({ kind: 'middleware', prefix, fn, isErrorHandler: fn.length >= 4 }),
    );
    return app;
  };

  for (const method of METHODS) {
    app[method] = (path, ...handlers) => {
      layers.push({
        kind: 'route',
        method,
        path,
        handlers: handlers.filter((h) => typeof h === 'function'),
      });
      return app;
    };
  }

  app.listen = (port, cb) => {
    app._listening = port;
    if (typeof cb === 'function') cb();
    return { close: () => {}, address: () => ({ port }) };
  };

  return app;
}

/** Flatten the middleware/router tree into the ordered layer stack Express would build. */
function collectStack(app) {
  const out = [];

  const walk = (layers, prefix) => {
    for (const layer of layers) {
      const join = (p) => `${prefix}${typeof p === 'string' && p !== '/' ? p : ''}`;

      if (layer.kind === 'middleware') {
        const fn = layer.fn;
        if (fn && fn._layers) {
          walk(fn._layers, join(layer.prefix));
        } else {
          out.push({
            kind: 'middleware',
            path: join(layer.prefix),
            fn,
            isErrorHandler: layer.isErrorHandler || fn.length >= 4,
          });
        }
        continue;
      }

      if (layer.kind === 'route') {
        for (const fn of layer.handlers) {
          out.push({
            kind: 'handler',
            path: join(layer.path),
            method: layer.method,
            fn,
            isErrorHandler: fn.length >= 4,
          });
        }
      }
    }
  };

  walk(app._layers, '');
  return out;
}

function invoke(fn, req, res, next, err) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const nextCb = (nextErr) => {
      if (settled) return;
      next(nextErr);
      done('next');
    };

    let ret;
    try {
      ret = err ? fn(err, req, res, nextCb) : fn(req, res, nextCb);
    } catch (thrown) {
      settled = true;
      reject(thrown);
      return;
    }

    if (ret && typeof ret.then === 'function') {
      ret
        .then(() => done('done'))
        .catch((rejection) => {
          if (settled) return;
          next(rejection);
          done('next');
        });
    } else {
      done('done');
    }
  });
}

export async function dispatch(app, { method = 'GET', path = '/', headers = {}, body, query } = {}) {
  const [pathname, search = ''] = String(path).split('?');
  const req = {
    method: String(method).toUpperCase(),
    path: pathname,
    originalUrl: path,
    url: path,
    headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
    body: body ?? {},
    query: query ?? parseQuery(search),
    params: {},
    user: undefined,
    cookies: {},
    get(name) {
      return this.headers[String(name).toLowerCase()];
    },
    header(name) {
      return this.headers[String(name).toLowerCase()];
    },
    on() {},
    app,
  };
  const res = createResponse();
  res.req = req;

  const stack = collectStack(app);
  let error = null;

  for (const entry of stack) {
    const isErrorLayer = entry.isErrorHandler || entry.fn?.length >= 4;

    if (isErrorLayer) {
      if (!error) continue;
    } else if (error) {
      continue;
    } else if (entry.kind === 'middleware') {
      if (entry.path && entry.path !== '/') {
        const params = matchPrefix(entry.path, pathname);
        if (!params) continue;
        req.params = { ...req.params, ...params };
      }
    } else if (entry.kind === 'handler') {
      if (entry.method && entry.method !== 'all' && entry.method.toUpperCase() !== req.method) continue;
      const params = matchPath(entry.path ?? '/', pathname);
      if (!params) continue;
      req.params = { ...req.params, ...params };
    }

    let outcome;
    try {
      outcome = await invoke(entry.fn, req, res, (err) => {
        error = err ?? null;
      }, isErrorLayer ? error : undefined);
    } catch (err) {
      // Express catches synchronous throws in a layer and forwards them to the
      // error-handling stack — mirror that so 500s behave realistically.
      error = err;
      outcome = 'next';
    }

    if (outcome === 'done') {
      return { status: res.statusCode, body: res.body, headers: res.headers, req, res };
    }
  }

  if (!res._ended) {
    if (error) {
      res.status(res.statusCode >= 400 ? res.statusCode : 500);
      res.json({ error: error.message ?? 'Internal Server Error' });
    } else {
      res.status(404);
      res.json({ error: `Cannot ${req.method} ${pathname}` });
    }
  }
  return { status: res.statusCode, body: res.body, headers: res.headers, req, res };
}

export function createExpress() {
  const express = (label) => createApp(label);
  express.Router = (label) => createRouter(label);
  express.json = () => (req, _res, next) => {
    req.body = req.body ?? {};
    next();
  };
  express.urlencoded = () => (_req, _res, next) => next();
  express.static = () => (_req, _res, next) => next();
  express.raw = () => (_req, _res, next) => next();
  express.text = () => (_req, _res, next) => next();
  return express;
}

/** Supertest-shaped client for the integration suite. */
export function api(app) {
  const bearer = (token, opts = {}) => ({
    ...opts,
    headers: { authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
  });

  return {
    get: (path, opts) => dispatch(app, { method: 'GET', path, ...opts }),
    post: (path, body, opts) => dispatch(app, { method: 'POST', path, body, ...opts }),
    put: (path, body, opts) => dispatch(app, { method: 'PUT', path, body, ...opts }),
    patch: (path, body, opts) => dispatch(app, { method: 'PATCH', path, body, ...opts }),
    delete: (path, opts) => dispatch(app, { method: 'DELETE', path, ...opts }),
    as: (token) => ({
      get: (path, opts) => dispatch(app, { method: 'GET', path, ...bearer(token, opts) }),
      post: (path, body, opts) => dispatch(app, { method: 'POST', path, body, ...bearer(token, opts) }),
      put: (path, body, opts) => dispatch(app, { method: 'PUT', path, body, ...bearer(token, opts) }),
      patch: (path, body, opts) => dispatch(app, { method: 'PATCH', path, body, ...bearer(token, opts) }),
      delete: (path, opts) => dispatch(app, { method: 'DELETE', path, ...bearer(token, opts) }),
    }),
  };
}

export { createApp, createRouter };
