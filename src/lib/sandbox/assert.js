/**
 * Minimal Node-flavoured assertion library used by the in-browser test runner.
 * Failures throw a tagged error so the runner can render an authentic-looking stack.
 */

export class AssertionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'AssertionError';
    this.expected = details.expected;
    this.actual = details.actual;
    this.isAssertion = true;
  }
}

const show = (v) => {
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'undefined') return 'undefined';
  if (v === null) return 'null';
  if (typeof v === 'function') return `[Function ${v.name || 'anonymous'}]`;
  try {
    return JSON.stringify(v, replacer, 0) ?? String(v);
  } catch {
    return String(v);
  }
};

const replacer = (_k, v) => {
  if (typeof v === 'function') return `[Function ${v.name || 'anonymous'}]`;
  if (typeof v === 'bigint') return `${v}n`;
  if (v instanceof RegExp) return String(v);
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  return v;
};

export function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a == null || b == null) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp) return String(a) === String(b);
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

const NOT_SUFFIX = 'expected the value NOT to satisfy this assertion';

function negate(api) {
  const inverted = {};
  for (const key of Object.keys(api)) {
    if (typeof api[key] !== 'function') continue;
    inverted[key] = (...args) => {
      try {
        api[key](...args);
      } catch {
        return api;
      }
      throw new AssertionError(
        `${NOT_SUFFIX}: .${key}(${args.map((a) => show(a)).join(', ')})`,
      );
    };
  }
  return inverted;
}

export function createExpect() {
  const build = (actual) => {
    const api = {
      toBe(expected) {
        if (!Object.is(actual, expected))
          throw new AssertionError(`Expected ${show(actual)} to be ${show(expected)}`, {
            expected,
            actual,
          });
        return api;
      },
      toEqual(expected) {
        if (!deepEqual(actual, expected))
          throw new AssertionError(`Expected ${show(actual)} to deeply equal ${show(expected)}`, {
            expected,
            actual,
          });
        return api;
      },
      toBeTruthy() {
        if (!actual)
          throw new AssertionError(`Expected ${show(actual)} to be truthy`, { expected: true, actual });
        return api;
      },
      toBeFalsy() {
        if (actual)
          throw new AssertionError(`Expected ${show(actual)} to be falsy`, { expected: false, actual });
        return api;
      },
      toBeNull() {
        if (actual !== null)
          throw new AssertionError(`Expected ${show(actual)} to be null`, { expected: null, actual });
        return api;
      },
      toBeUndefined() {
        if (actual !== undefined)
          throw new AssertionError(`Expected ${show(actual)} to be undefined`, {
            expected: undefined,
            actual,
          });
        return api;
      },
      toBeDefined() {
        if (actual === undefined)
          throw new AssertionError('Expected value to be defined', { expected: 'defined' });
        return api;
      },
      toBeInstanceOf(ctor) {
        if (!(actual instanceof ctor))
          throw new AssertionError(
            `Expected value to be an instance of ${ctor?.name}, received ${show(actual)}`,
            { expected: ctor?.name, actual },
          );
        return api;
      },
      toContain(subset) {
        const ok =
          typeof actual === 'string'
            ? actual.includes(subset)
            : Array.isArray(actual) && actual.some((x) => deepEqual(x, subset));
        if (!ok)
          throw new AssertionError(`Expected ${show(actual)} to contain ${show(subset)}`, {
            expected: subset,
            actual,
          });
        return api;
      },
      toHaveLength(n) {
        const len = actual?.length;
        if (len !== n)
          throw new AssertionError(`Expected length ${show(len)} to be ${n}`, { expected: n, actual: len });
        return api;
      },
      toBeGreaterThan(n) {
        if (!(actual > n))
          throw new AssertionError(`Expected ${show(actual)} to be greater than ${n}`, {
            expected: `> ${n}`,
            actual,
          });
        return api;
      },
      toBeGreaterThanOrEqual(n) {
        if (!(actual >= n))
          throw new AssertionError(`Expected ${show(actual)} to be >= ${n}`, {
            expected: `>= ${n}`,
            actual,
          });
        return api;
      },
      toBeLessThan(n) {
        if (!(actual < n))
          throw new AssertionError(`Expected ${show(actual)} to be less than ${n}`, {
            expected: `< ${n}`,
            actual,
          });
        return api;
      },
      toBeCloseTo(n, precision = 2) {
        if (Math.abs(actual - n) >= Math.pow(10, -precision) / 2)
          throw new AssertionError(`Expected ${show(actual)} to be close to ${n}`, {
            expected: n,
            actual,
          });
        return api;
      },
      toMatch(pattern) {
        const re = pattern instanceof RegExp ? pattern : new RegExp(pattern);
        if (typeof actual !== 'string' || !re.test(actual))
          throw new AssertionError(`Expected ${show(actual)} to match ${re}`, {
            expected: String(re),
            actual,
          });
        return api;
      },
      toThrow(expected) {
        let threw = null;
        try {
          actual();
        } catch (e) {
          threw = e;
        }
        if (!threw)
          throw new AssertionError('Expected function to throw, but it did not throw', {
            expected: 'a thrown error',
          });
        if (expected instanceof RegExp && !expected.test(threw.message))
          throw new AssertionError(`Thrown message ${show(threw.message)} does not match ${expected}`, {
            expected: String(expected),
            actual: threw.message,
          });
        if (typeof expected === 'string' && !String(threw.message).includes(expected))
          throw new AssertionError(`Thrown message ${show(threw.message)} does not include ${show(expected)}`, {
            expected,
            actual: threw.message,
          });
        return api;
      },
    };
    api.not = negate(api);
    return api;
  };

  const expect = (actual) => build(actual);

  expect.fail = (msg) => {
    throw new AssertionError(msg || 'Test failed');
  };
  expect.assertions = () => {};
  expect.any = (ctor) => ({
    __any: ctor,
    toString: () => `Any<${ctor?.name ?? 'unknown'}>`,
  });
  return expect;
}

export const assert = (condition, message = 'Assertion failed') => {
  if (!condition) throw new AssertionError(message);
};
