/**
 * Test orchestration for both assessment rounds.
 *
 * Three assertion strategies run against the candidate's *real* code:
 *   static      — structural / semantic checks over file source (hooks, try-catch, exports)
 *   runtime     — the module is compiled and executed, then its exports are exercised
 *   integration — the candidate's Express app is booted inside the simulator and hit over HTTP
 *
 * Nothing is mocked away that matters: an `async` route that rejects, a middleware that
 * forgets `next()`, or a stale-closure effect all fail exactly the way they would in CI.
 */

import { createExpect, AssertionError } from './sandbox/assert.js';
import { createModuleSystem, runtimeGlobals } from './sandbox/moduleSystem.js';
import { createExpress, api, createApp } from './sandbox/expressMock.js';

const TEST_TIMEOUT_MS = 4000;
const BOOT_DELAY_MS = 320;
const PER_TEST_DELAY_MS = 70;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const stringify = (v) => {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms — ${label}`)), ms);
    }),
  ]);
}

const INTERNAL_FRAME = /capex:\/\/\/|\/src\/lib\/|node_modules|<anonymous>:1|eval at/;

export function formatError(error, test) {
  const name = error?.name === 'AssertionError' ? 'AssertionError' : (error?.name ?? 'Error');
  const message = error?.message ?? String(error);
  const raw = String(error?.stack ?? '')
    .split('\n')
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('at ') && !INTERNAL_FRAME.test(l))
    .slice(0, 3);

  const frame = raw[0] ?? `at ${test.suiteFile ?? 'tests/index.test.js'} (${test.file ?? 'repo'}:1:1)`;
  const rest = raw.slice(1);
  const fallbackFrame = `at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

  return [`${name}: ${message}`, `    ${frame}`, ...rest.map((l) => `    ${l}`), `    ${fallbackFrame}`]
    .filter(Boolean)
    .join('\n');
}

/**
 * @param {object} opts
 * @param {object} opts.suite          suite descriptor from /data
 * @param {Record<string,string>} opts.files  the candidate's virtual repository
 * @param {(event:object)=>void} [opts.onEvent]
 * @param {(name:string, factory:Function)=>any} [opts.mocks]  extra bare-module mocks
 */
export async function runTestSuite({ suite, files, onEvent = () => {}, mocks = {}, seed }) {
  const started = performance.now();
  onEvent({ type: 'boot', label: 'Installing dependencies', detail: 'npm install' });
  await delay(BOOT_DELAY_MS);

  const express = createExpress();
  const expect = createExpect();

  const results = [];
  let passed = 0;
  let pointsEarned = 0;
  const totalPoints = suite.tests.reduce((sum, t) => sum + (t.points ?? 0), 0);

  for (const test of suite.tests) {
    onEvent({ type: 'test-start', id: test.id });
    await delay(PER_TEST_DELAY_MS);

    const t0 = performance.now();
    let status = 'pass';
    let message = '';
    let stack = '';
    let expected;
    let actual;

    const logs = [];
    const captureConsole = {
      log: (...args) => logs.push({ level: 'log', text: args.map(stringify).join(' ') }),
      info: (...args) => logs.push({ level: 'info', text: args.map(stringify).join(' ') }),
      warn: (...args) => logs.push({ level: 'warn', text: args.map(stringify).join(' ') }),
      error: (...args) => logs.push({ level: 'error', text: args.map(stringify).join(' ') }),
      debug: () => {},
    };

    const system = createModuleSystem(
      files,
      { express, ...mocks },
      { ...runtimeGlobals, console: captureConsole },
    );
    system.registry.set('express', express);

    const ctx = {
      expect,
      express,
      files,
      seed,
      system,
      logs,
      read: (path) => files[path],
      exists: (path) => Object.prototype.hasOwnProperty.call(files, path),
      load: (path) => system.load(path),
      createApp,
      api: null,
      lines: (path) => String(files[path] ?? '').split('\n'),
    };

    try {
      if (typeof test.setup === 'function') {
        await withTimeout(Promise.resolve(test.setup(ctx)), TEST_TIMEOUT_MS, test.title);
      }
      if (test.kind === 'integration' || test.kind === 'runtime') {
        let app = null;
        if (test.appPath) app = system.load(test.appPath);
        else if (test.appFactory) {
          const mod = system.load(test.appFactory.path);
          app = mod[test.appFactory.export]();
        }
        ctx.app = app;
        ctx.api = app ? api(app) : null;
      }
      const outcome = await withTimeout(Promise.resolve(test.run(ctx)), TEST_TIMEOUT_MS, test.title);
      if (outcome && outcome.ok === false) {
        status = 'fail';
        message = outcome.message ?? 'Test failed';
        expected = outcome.expected;
        actual = outcome.actual;
      }
    } catch (err) {
      status = 'fail';
      message = err?.message ?? String(err);
      expected = err?.expected;
      actual = err?.actual;
      stack = formatError(err, test);
    }

    const duration = Math.round(performance.now() - t0);
    if (status === 'pass') {
      passed += 1;
      pointsEarned += test.points ?? 0;
    }

    const result = {
      id: test.id,
      title: test.title,
      file: test.file,
      kind: test.kind,
      category: test.category,
      severity: test.severity,
      points: test.points ?? 0,
      status,
      message,
      stack,
      expected,
      actual,
      duration,
      logs,
      hint: test.hint,
    };
    results.push(result);
    onEvent({ type: 'test-done', result, index: results.length - 1 });
  }

  const durationMs = Math.round(performance.now() - started);
  const failed = results.filter((r) => r.status === 'fail');

  return {
    suiteId: suite.id,
    mode: suite.mode,
    ranAt: new Date().toISOString(),
    results,
    passed,
    failed: failed.length,
    total: suite.tests.length,
    score: totalPoints === 0 ? 0 : Math.round((pointsEarned / totalPoints) * 100),
    pointsEarned,
    totalPoints,
    durationMs,
    verdict:
      failed.length === 0 ? 'passed' : pointsEarned / totalPoints >= 0.75 ? 'borderline' : 'failed',
  };
}

export { AssertionError };
