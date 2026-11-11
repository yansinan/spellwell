/**
 * @layer tests
 * @phase P0
 * @doc §3.1 技术选型
 *
 * 零框架测试工具。runner 负责阶段门与输出；本文件只负责注册、断言与执行。
 */

import { isDeepStrictEqual } from 'node:util';

/** @type {{file: string, name: string, fn: () => unknown|Promise<unknown>}[]} */
const registered = [];
let activeFile = '(unknown)';

export class AssertionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AssertionError';
  }
}

/**
 * @param {string} file
 */
export function setActiveFile(file) {
  activeFile = file;
}

/**
 * @param {string} name
 * @param {() => unknown|Promise<unknown>} fn
 */
export function test(name, fn) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new TypeError('test name must be a non-empty string');
  }
  if (typeof fn !== 'function') {
    throw new TypeError(`test "${name}" needs a function`);
  }
  registered.push({ file: activeFile, name, fn });
}

/** @returns {{file: string, name: string, fn: () => unknown|Promise<unknown>}[]} */
export function getRegisteredTests() {
  return [...registered];
}

/**
 * @param {unknown} condition
 * @param {string} [message]
 */
export function assert(condition, message = 'expected a truthy value') {
  if (!condition) throw new AssertionError(message);
}

/**
 * @param {unknown} actual
 * @param {unknown} expected
 * @param {string} [message]
 */
export function assertEqual(actual, expected, message = 'values are not equal') {
  if (!Object.is(actual, expected)) {
    throw new AssertionError(`${message}\n  actual:   ${format(actual)}\n  expected: ${format(expected)}`);
  }
}

/**
 * @param {unknown} actual
 * @param {unknown} expected
 * @param {string} [message]
 */
export function assertDeepEqual(actual, expected, message = 'values are not deeply equal') {
  if (!isDeepStrictEqual(actual, expected)) {
    throw new AssertionError(`${message}\n  actual:   ${format(actual)}\n  expected: ${format(expected)}`);
  }
}

/**
 * @param {unknown} value
 * @param {RegExp} pattern
 * @param {string} [message]
 */
export function assertMatch(value, pattern, message = 'value does not match pattern') {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new AssertionError(`${message}\n  actual: ${format(value)}\n  pattern: ${pattern}`);
  }
}

/**
 * @param {unknown} value
 * @param {unknown} expected
 * @param {string} [message]
 */
export function assertIncludes(value, expected, message = 'value does not include expected') {
  let ok = false;
  if (typeof value === 'string') ok = value.includes(/** @type {string} */ (expected));
  else if (Array.isArray(value)) ok = value.includes(expected);
  if (!ok) {
    throw new AssertionError(`${message}\n  actual: ${format(value)}\n  expected to include: ${format(expected)}`);
  }
}

/**
 * @param {() => unknown} fn
 * @param {Function|string|RegExp|undefined} expected
 * @returns {Error}
 */
export function assertThrows(fn, expected) {
  let thrown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  if (!thrown) throw new AssertionError('expected function to throw, but it returned normally');
  checkExpectedError(thrown, expected);
  return thrown;
}

/**
 * @param {() => Promise<unknown>} fn
 * @param {Function|string|RegExp|undefined} expected
 * @returns {Promise<Error>}
 */
export async function assertRejects(fn, expected) {
  let thrown;
  try {
    await fn();
  } catch (error) {
    thrown = error;
  }
  if (!thrown) throw new AssertionError('expected promise to reject, but it resolved');
  checkExpectedError(thrown, expected);
  return thrown;
}

/**
 * @param {unknown} error
 * @param {Function|string|RegExp|undefined} expected
 */
function checkExpectedError(error, expected) {
  if (!(error instanceof Error)) {
    throw new AssertionError(`thrown value is not an Error: ${format(error)}`);
  }
  if (expected === undefined) return;
  if (typeof expected === 'string') {
    if (error.code !== expected && error.name !== expected) {
      throw new AssertionError(`wrong error: expected code/name ${expected}, got ${error.code ?? error.name}: ${error.message}`);
    }
    return;
  }
  if (expected instanceof RegExp) {
    if (!expected.test(error.message)) {
      throw new AssertionError(`error message does not match ${expected}: ${error.message}`);
    }
    return;
  }
  if (typeof expected === 'function') {
    if (!(error instanceof expected)) {
      throw new AssertionError(`wrong error type: expected ${expected.name}, got ${error.name}: ${error.message}`);
    }
    return;
  }
  throw new AssertionError('unsupported expected-error matcher');
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function format(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
