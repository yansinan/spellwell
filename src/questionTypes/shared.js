/**
 * @layer questionTypes
 * @phase P1
 * @doc §3.4 9 个题型注册表
 *
 * P1 三种题型共享的纯函数：资源校验、错误定位、整词输入分析。
 * 这里不查库、不碰 DOM、不写学习状态。
 */

import { validateAttemptResult } from '../core/contracts.js';
import { ContractError } from '../core/errors.js';

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 校验并返回 ResourceBundle 里的 word。切分必须已经人工完成。
 * @param {{word?: unknown, graphemes?: unknown}} bundle
 * @returns {{id: string, text: string, units: {text: string, graphemeId: string}[], [key: string]: unknown}}
 */
export function getWord(bundle) {
  if (!isObject(bundle) || !isObject(bundle.word)) {
    throw new ContractError('RESOURCE_BUNDLE_INVALID', 'bundle.word is required');
  }
  const word = /** @type {Record<string, unknown>} */ (bundle.word);
  if (typeof word.id !== 'string' || word.id.length === 0) {
    throw new ContractError('RESOURCE_BUNDLE_INVALID', 'word.id must be a non-empty string');
  }
  if (typeof word.text !== 'string' || word.text.length === 0) {
    throw new ContractError('RESOURCE_BUNDLE_INVALID', 'word.text must be a non-empty string');
  }
  if (!Array.isArray(word.units) || word.units.length === 0) {
    throw new ContractError('RESOURCE_BUNDLE_INVALID', `${word.id} needs manually annotated units`);
  }

  let joined = '';
  const units = word.units.map((rawUnit, index) => {
    if (!isObject(rawUnit)) {
      throw new ContractError('RESOURCE_BUNDLE_INVALID', `${word.id} unit ${index} must be an object`);
    }
    const unit = /** @type {Record<string, unknown>} */ (rawUnit);
    if (typeof unit.text !== 'string' || unit.text.length === 0) {
      throw new ContractError('RESOURCE_BUNDLE_INVALID', `${word.id} unit ${index} has no text`);
    }
    if (typeof unit.graphemeId !== 'string' || unit.graphemeId.length === 0) {
      throw new ContractError('RESOURCE_BUNDLE_INVALID', `${word.id} unit ${index} has no graphemeId`);
    }
    joined += unit.text;
    return { text: unit.text, graphemeId: unit.graphemeId };
  });

  if (joined !== word.text) {
    throw new ContractError(
      'RESOURCE_BUNDLE_INVALID',
      `${word.id} units join to "${joined}", expected "${word.text}"`,
    );
  }
  return /** @type {any} */ ({ ...word, units });
}

/**
 * @param {{id: string}} word
 * @param {number} index
 * @returns {string}
 */
export function wordUnitId(word, index) {
  return `${word.id}#${index}`;
}

/**
 * @param {{id: string, units: {text: string, graphemeId: string}[]}} word
 * @returns {{unitId: string, text: string, kind: 'letter'|'grapheme'}[]}
 */
export function renderUnitsForWord(word) {
  // P1 renders one tile per annotated grapheme. Letter/mixed granularity is a
  // future spec-level option; see ADR-0004 and R-UNIT-01.
  return word.units.map((unit, index) => ({
    unitId: wordUnitId(word, index),
    text: unit.text,
    kind: unit.text.length === 1 ? 'letter' : 'grapheme',
  }));
}

/**
 * @param {import('../core/contracts.js').QuestionSpec} spec
 * @param {{word: {units: {graphemeId: string}[]}}} bundle
 */
export function assertFocusInWord(spec, bundle) {
  if (!spec.focus) return;
  if (!bundle.word.units.some((unit) => unit.graphemeId === spec.focus?.id)) {
    throw new ContractError(
      'QUESTION_SPEC_INVALID',
      `focus ${spec.focus.id} is not a unit of the target word`,
    );
  }
}

/**
 * 把 spec 中提供的干扰组合变成 RenderUnit。题型层不生成干扰项。
 * @param {import('../core/contracts.js').QuestionSpec} spec
 * @param {{graphemes?: Record<string, {id?: string, text?: string}>}} bundle
 * @returns {{unitId: string, text: string, kind: 'letter'|'grapheme'}[]}
 */
export function distractorUnits(spec, bundle) {
  const ids = spec.params?.distractorGraphemeIds;
  if (ids === undefined) return [];
  if (!Array.isArray(ids)) {
    throw new ContractError('QUESTION_SPEC_INVALID', 'distractorGraphemeIds must be an array');
  }
  const seen = new Set();
  const units = [];
  for (const id of ids) {
    if (typeof id !== 'string' || seen.has(id)) continue;
    const grapheme = bundle.graphemes?.[id];
    if (!grapheme || typeof grapheme.text !== 'string' || grapheme.text.length === 0) {
      throw new ContractError('QUESTION_SPEC_INVALID', `unknown distractor grapheme ${id}`);
    }
    seen.add(id);
    units.push({
      unitId: `distractor:${id}`,
      text: grapheme.text,
      kind: grapheme.text.length === 1 ? 'letter' : 'grapheme',
    });
  }
  return units;
}

/**
 * @param {{id: string, units: {text: string, graphemeId: string}[]}} word
 * @param {import('../core/contracts.js').FocusRef|undefined} focus
 * @returns {number[]}
 */
export function focusUnitIndexes(word, focus) {
  if (!focus) return [];
  return word.units
    .map((unit, index) => (unit.graphemeId === focus.id ? index : -1))
    .filter((index) => index >= 0);
}

/**
 * @param {{units: {text: string}[]}} word
 * @param {number} index
 * @returns {{start: number, end: number}}
 */
function unitRange(word, index) {
  let start = 0;
  for (let cursor = 0; cursor < index; cursor += 1) start += word.units[cursor].text.length;
  return { start, end: start + word.units[index].text.length };
}

/**
 * @param {{id: string, units: {text: string, graphemeId: string}[]}} word
 * @param {number} charIndex
 * @returns {{index: number, start: number, end: number}}
 */
export function unitIndexAtChar(word, charIndex) {
  let start = 0;
  for (let index = 0; index < word.units.length; index += 1) {
    const end = start + word.units[index].text.length;
    if (charIndex < end) return { index, start, end };
    start = end;
  }
  return { index: word.units.length, start, end: start };
}

/**
 * @param {{
 *   type: string,
 *   word: {id: string, units: {text: string, graphemeId: string}[]},
 *   unitIndex: number,
 *   expected: string,
 *   actual: string
 * }} input
 * @returns {import('../core/contracts.js').ErrorProfile}
 */
export function errorFor({ type, word, unitIndex, expected, actual }) {
  const position = Math.max(0, Math.trunc(unitIndex));
  const unit = word.units[Math.min(position, word.units.length - 1)];
  return {
    type,
    unitKind: 'grapheme',
    unitId: unit?.graphemeId ?? word.id,
    position,
    expected: String(expected ?? ''),
    actual: String(actual ?? ''),
  };
}

/**
 * @param {{
 *   spec: import('../core/contracts.js').QuestionSpec,
 *   wordCorrect: boolean,
 *   focusCorrect?: boolean,
 *   firstError: import('../core/contracts.js').ErrorProfile|null,
 *   now?: number
 * }} input
 * @returns {import('../core/contracts.js').AttemptResult}
 */
export function makeAttempt({ spec, wordCorrect, focusCorrect, firstError, now }) {
  /** @type {import('../core/contracts.js').AttemptResult} */
  const result = {
    specId: spec.specId,
    wordId: spec.target.id,
    wordCorrect: Boolean(wordCorrect),
    firstError: firstError ?? null,
    timestamp: Number.isFinite(now) ? /** @type {number} */ (now) : Date.now(),
  };
  if (focusCorrect !== undefined) result.focusCorrect = Boolean(focusCorrect);
  validateAttemptResult(result);
  return result;
}

/**
 * 组合 focus 是否拼对（按 unit 文本比较）。
 * @param {{units: {text: string}[]}} word
 * @param {string[]} chosenTexts
 * @param {import('../core/contracts.js').FocusRef|undefined} focus
 * @returns {boolean|undefined}
 */
export function focusCorrectFromUnitTexts(word, chosenTexts, focus) {
  const indexes = focusUnitIndexes(word, focus);
  if (indexes.length === 0) return undefined;
  return indexes.every((index) => chosenTexts[index] === word.units[index].text);
}

/**
 * @param {{units: {text: string}[]}} word
 * @param {string} typed
 * @param {import('../core/contracts.js').FocusRef|undefined} focus
 * @returns {boolean|undefined}
 */
export function focusCorrectFromTyped(word, typed, focus) {
  const indexes = focusUnitIndexes(word, focus);
  if (indexes.length === 0) return undefined;
  return indexes.every((index) => {
    const range = unitRange(word, index);
    const expected = word.units[index].text;
    return typed.slice(range.start, range.end) === expected;
  });
}

/**
 * @param {string[]} left
 * @param {string[]} right
 * @returns {boolean}
 */
export function sameUnitMultiset(left, right) {
  if (left.length !== right.length) return false;
  const counts = new Map();
  for (const text of left) counts.set(text, (counts.get(text) ?? 0) + 1);
  for (const text of right) {
    const count = counts.get(text);
    if (!count) return false;
    counts.set(text, count - 1);
  }
  return true;
}

/**
 * @param {string[]} chosen
 * @param {string[]} target
 * @returns {number} 第一个不同的下标，全部相同返回 -1
 */
export function firstUnitMismatch(chosen, target) {
  const length = Math.min(chosen.length, target.length);
  for (let index = 0; index < length; index += 1) {
    if (chosen[index] !== target[index]) return index;
  }
  return -1;
}

/**
 * 整词输入分析。返回 AttemptResult 需要的三个字段。
 * 归一化：trim + lowercase；错误定位到 grapheme unit。
 * @param {{
 *   word: {id: string, text: string, units: {text: string, graphemeId: string}[]},
 *   typed: string,
 *   focus?: import('../core/contracts.js').FocusRef
 * }} input
 * @returns {{wordCorrect: boolean, focusCorrect: boolean|undefined, firstError: import('../core/contracts.js').ErrorProfile|null}}
 */
export function analyzeTyped({ word, typed, focus }) {
  const target = word.text.toLowerCase();
  const normalized = String(typed ?? '').trim().toLowerCase();
  const focusCorrect = focusCorrectFromTyped(word, normalized, focus);

  if (normalized === target) {
    return { wordCorrect: true, focusCorrect: focus ? true : undefined, firstError: null };
  }

  if (normalized.length === 0) {
    return {
      wordCorrect: false,
      focusCorrect: focus ? false : undefined,
      firstError: errorFor({
        type: 'OMISSION',
        word,
        unitIndex: 0,
        expected: word.units[0].text,
        actual: '',
      }),
    };
  }

  let mismatch = 0;
  while (
    mismatch < target.length
    && mismatch < normalized.length
    && target[mismatch] === normalized[mismatch]
  ) {
    mismatch += 1;
  }

  if (mismatch === target.length) {
    return {
      wordCorrect: false,
      focusCorrect,
      firstError: errorFor({
        type: 'EXTRA',
        word,
        unitIndex: word.units.length,
        expected: '',
        actual: normalized.slice(mismatch),
      }),
    };
  }

  const position = unitIndexAtChar(word, mismatch);

  if (mismatch === normalized.length) {
    return {
      wordCorrect: false,
      focusCorrect,
      firstError: errorFor({
        type: 'OMISSION',
        word,
        unitIndex: position.index,
        expected: word.units[position.index].text,
        actual: '',
      }),
    };
  }

  const isTransposition = normalized.length === target.length
    && [...normalized].sort().join('') === [...target].sort().join('');

  return {
    wordCorrect: false,
    focusCorrect,
    firstError: errorFor({
      type: isTransposition ? 'TRANSPOSITION' : 'SUBSTITUTION',
      word,
      unitIndex: position.index,
      expected: word.units[position.index].text,
      actual: normalized.slice(position.start, Math.min(position.end, normalized.length)),
    }),
  };
}
