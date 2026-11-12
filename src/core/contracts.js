/**
 * @layer core
 * @phase P0
 * @doc §5.2 核心契约
 *
 * 跨层数据结构的唯一真相。所有校验在边界执行一次，内部纯函数不重复校验。
 */

import { ContractError } from './errors.js';
import { isDayKey } from './time.js';

export const CONTRACT_VERSION = 1;
export const MAX_SEED = 0xffffffff;
export const MAX_ERROR_PROFILE_ENTRIES = 8;

export const ERROR_TYPES = Object.freeze([
  'OMISSION',
  'SUBSTITUTION',
  'TRANSPOSITION',
  'EXTRA',
  'BOUNDARY_OVER_SEGMENT',
  'BOUNDARY_UNDER_SEGMENT',
  'BOUNDARY_MISPLACED',
  'SUFFIX_RULE',
  'UNKNOWN',
]);

export const WORD_STATUS = Object.freeze(['unstarted', 'learning', 'reviewing', 'probe', 'mastered']);
export const GRAPHEME_STATUS = Object.freeze(['learning', 'reviewing', 'probe', 'steady']);

export const INPUT_EVENT_KINDS = Object.freeze([
  'tap-unit',
  'drag-unit',
  'key-text',
  'reorder',
  'edit',
  'tap-gap',
]);

export const UNIT_KINDS = Object.freeze(['grapheme', 'letter', 'suffix']);

export const LAST_RESULTS = Object.freeze(['correct', 'wrong', null]);

/**
 * @typedef {Object} TargetRef
 * @property {'word'} kind
 * @property {string} id
 */

/**
 * @typedef {Object} FocusRef
 * @property {'grapheme'} kind
 * @property {string} id
 */

/**
 * @typedef {Object} QuestionSpec
 * @property {string} specId 稳定、可与 seed 一起复现
 * @property {string} typeId 例如 'T-SEQUENCE'
 * @property {TargetRef} target
 * @property {FocusRef} [focus]
 * @property {Record<string, unknown>} params
 * @property {Record<string, unknown>} resourceHints
 * @property {number} seed uint32
 */

/**
 * @typedef {Object} RenderSlot
 * @property {string} slotId
 * @property {number} index
 * @property {'unit'|'letter'|'gap'} [accepts]
 */

/**
 * @typedef {Object} RenderUnit
 * @property {string} unitId
 * @property {string} text
 * @property {'grapheme'|'letter'|'suffix'} [kind]
 */

/**
 * @typedef {Object} InteractionHints
 * @property {boolean} allowTap
 * @property {boolean} allowDrag
 * @property {boolean} allowKeyboard
 * @property {boolean} allowReorder
 * @property {boolean} allowEdit
 * @property {'word'|'grapheme'} [keyboardScope]
 */

/**
 * @typedef {Object} RenderModel
 * @property {string} layout
 * @property {RenderSlot[]} slots
 * @property {RenderUnit[]} units
 * @property {string} [fixedText]
 * @property {FocusRef} [focus]
 * @property {InteractionHints} interactionHints
 * @property {number} seed
 */

/**
 * @typedef {Object} InputEvent
 * @property {'tap-unit'|'drag-unit'|'key-text'|'reorder'|'edit'|'tap-gap'} kind
 * @property {string} [unitId]
 * @property {number} [slotIndex]
 * @property {number} [fromIndex]
 * @property {number} [toIndex]
 * @property {string} [text]
 * @property {number} [gapIndex]
 * @property {'insert'|'delete'|'replace'|'move'} [op]
 */

/**
 * @typedef {Object} ErrorProfile
 * @property {string} type ERROR_TYPES 之一
 * @property {'word'|'grapheme'|'letter'} unitKind
 * @property {string} unitId
 * @property {number} position 0-based
 * @property {string} expected
 * @property {string} actual 可为空（遗漏）
 */

/**
 * @typedef {Object} AttemptResult
 * @property {string} specId
 * @property {string} wordId
 * @property {boolean} wordCorrect
 * @property {boolean} [focusCorrect]
 * @property {ErrorProfile|null} [firstError]
 * @property {number} timestamp epoch ms
 */

/**
 * @typedef {Object} WordState
 * @property {string} wordId
 * @property {number} intervalIndex
 * @property {number} consecutiveCorrect
 * @property {'correct'|'wrong'|null} lastResult
 * @property {ErrorProfile[]} errorProfile
 * @property {'unstarted'|'learning'|'reviewing'|'probe'|'mastered'} status
 * @property {string|null} dueDate YYYY-MM-DD
 * @property {string} [updatedAt] ISO datetime
 * @property {'practice'|'admin-placement'} [source]
 */

/**
 * @typedef {Object} GraphemeState
 * @property {string} graphemeId
 * @property {number} intervalIndex
 * @property {number} consecutiveCorrect
 * @property {string[]} wordsPassed
 * @property {'learning'|'reviewing'|'probe'|'steady'} status
 * @property {string|null} dueDate
 * @property {'correct'|'wrong'|null} [lastResult]
 * @property {string} [updatedAt]
 */

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @returns {never}
 */
function fail(code, message, field) {
  throw new ContractError(code, message, field ? { field } : {});
}

/** @param {unknown} value */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {string} code
 * @returns {Record<string, unknown>}
 */
function objectAt(value, field, code) {
  if (!isPlainObject(value)) fail(code, `${field} must be an object`, field);
  return /** @type {Record<string, unknown>} */ (value);
}

/**
 * @param {Record<string, unknown>} obj
 * @param {string} field
 * @param {string} code
 * @returns {string}
 */
function stringAt(obj, field, code) {
  const value = obj[field];
  if (typeof value !== 'string' || value.length === 0) {
    fail(code, `${field} must be a non-empty string`, field);
  }
  return value;
}

/**
 * @param {Record<string, unknown>} obj
 * @param {string} field
 * @param {string} code
 * @param {number} [min]
 * @returns {number}
 */
function integerAt(obj, field, code, min = 0) {
  const value = obj[field];
  if (!Number.isInteger(value) || /** @type {number} */ (value) < min) {
    fail(code, `${field} must be an integer >= ${min}`, field);
  }
  return /** @type {number} */ (value);
}

/**
 * @param {Record<string, unknown>} obj
 * @param {string} field
 * @param {string} code
 * @returns {boolean}
 */
function booleanAt(obj, field, code) {
  const value = obj[field];
  if (typeof value !== 'boolean') fail(code, `${field} must be a boolean`, field);
  return value;
}

/**
 * @param {unknown} value
 * @param {readonly unknown[]} allowed
 * @param {string} field
 * @param {string} code
 */
function enumAt(value, allowed, field, code) {
  if (!allowed.includes(value)) {
    fail(code, `${field} must be one of ${allowed.map(String).join(', ')}`, field);
  }
}

/**
 * @param {unknown} seed
 * @param {string} code
 * @returns {number}
 */
function seedAt(seed, code) {
  if (!Number.isInteger(seed) || /** @type {number} */ (seed) < 0 || /** @type {number} */ (seed) > MAX_SEED) {
    fail(code, `seed must be a uint32, got ${String(seed)}`, 'seed');
  }
  return /** @type {number} */ (seed);
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {string} code
 * @returns {TargetRef|FocusRef}
 */
function refAt(value, field, code, kind) {
  const ref = objectAt(value, field, code);
  if (ref.kind !== kind) fail(code, `${field}.kind must be "${kind}"`, `${field}.kind`);
  stringAt(ref, 'id', code);
  return /** @type {TargetRef|FocusRef} */ (/** @type {unknown} */ (ref));
}

/**
 * @param {unknown} value
 * @param {string} [field]
 * @returns {true}
 */
export function validateQuestionSpec(value, field = 'spec') {
  const code = 'QUESTION_SPEC_INVALID';
  const spec = objectAt(value, field, code);
  stringAt(spec, 'specId', code);
  const typeId = stringAt(spec, 'typeId', code);
  if (!/^T-[A-Z]+(?:-[A-Z]+)*$/.test(typeId)) {
    fail(code, 'typeId must look like "T-SEQUENCE"', 'typeId');
  }
  refAt(spec.target, 'target', code, 'word');
  if (spec.focus !== undefined && spec.focus !== null) {
    refAt(spec.focus, 'focus', code, 'grapheme');
  }
  objectAt(spec.params, 'params', code);
  objectAt(spec.resourceHints, 'resourceHints', code);
  seedAt(spec.seed, code);
  return true;
}

/**
 * @param {unknown} value
 * @param {string} [field]
 * @returns {true}
 */
export function validateRenderModel(value, field = 'renderModel') {
  const code = 'RENDER_MODEL_INVALID';
  const model = objectAt(value, field, code);
  stringAt(model, 'layout', code);

  if (!Array.isArray(model.slots)) fail(code, 'slots must be an array', 'slots');
  const slotIds = new Set();
  const slotIndexes = new Set();
  for (const [index, rawSlot] of model.slots.entries()) {
    const path = `slots[${index}]`;
    const slot = objectAt(rawSlot, path, code);
    const slotId = stringAt(slot, 'slotId', code);
    if (slotIds.has(slotId)) fail(code, `duplicate slotId "${slotId}"`, path);
    slotIds.add(slotId);
    const slotIndex = integerAt(slot, 'index', code);
    if (slotIndexes.has(slotIndex)) fail(code, `duplicate slot index ${slotIndex}`, path);
    slotIndexes.add(slotIndex);
    if (slot.accepts !== undefined) {
      enumAt(slot.accepts, ['unit', 'letter', 'gap'], `${path}.accepts`, code);
    }
  }

  if (!Array.isArray(model.units)) fail(code, 'units must be an array', 'units');
  const unitIds = new Set();
  for (const [index, rawUnit] of model.units.entries()) {
    const path = `units[${index}]`;
    const unit = objectAt(rawUnit, path, code);
    const unitId = stringAt(unit, 'unitId', code);
    if (unitIds.has(unitId)) fail(code, `duplicate unitId "${unitId}"`, path);
    unitIds.add(unitId);
    stringAt(unit, 'text', code);
    if (unit.kind !== undefined) {
      enumAt(unit.kind, UNIT_KINDS, `${path}.kind`, code);
    }
  }

  if (model.fixedText !== undefined && typeof model.fixedText !== 'string') {
    fail(code, 'fixedText must be a string', 'fixedText');
  }
  if (model.focus !== undefined && model.focus !== null) {
    refAt(model.focus, 'focus', code, 'grapheme');
  }

  const hints = objectAt(model.interactionHints, 'interactionHints', code);
  for (const key of ['allowTap', 'allowDrag', 'allowKeyboard', 'allowReorder', 'allowEdit']) {
    booleanAt(hints, key, code);
  }
  if (hints.keyboardScope !== undefined) {
    enumAt(hints.keyboardScope, ['word', 'grapheme'], 'interactionHints.keyboardScope', code);
  }
  seedAt(model.seed, code);
  return true;
}

/**
 * @param {unknown} value
 * @param {string} [field]
 * @returns {true}
 */
export function validateInputEvent(value, field = 'inputEvent') {
  const code = 'INPUT_EVENT_INVALID';
  const event = objectAt(value, field, code);
  enumAt(event.kind, INPUT_EVENT_KINDS, 'kind', code);

  switch (event.kind) {
    case 'tap-unit':
    case 'drag-unit':
      stringAt(event, 'unitId', code);
      if (event.slotIndex !== undefined) integerAt(event, 'slotIndex', code);
      break;
    case 'key-text':
      if (typeof event.text !== 'string') fail(code, 'text must be a string', 'text');
      break;
    case 'reorder':
      integerAt(event, 'fromIndex', code);
      integerAt(event, 'toIndex', code);
      break;
    case 'edit':
      if (event.text !== undefined && typeof event.text !== 'string') {
        fail(code, 'text must be a string when present', 'text');
      }
      if (event.op !== undefined) {
        enumAt(event.op, ['insert', 'delete', 'replace', 'move'], 'op', code);
      }
      break;
    case 'tap-gap':
      integerAt(event, 'gapIndex', code);
      break;
    default:
      break;
  }
  return true;
}

/**
 * @param {unknown} value
 * @param {string} [field]
 * @returns {true}
 */
export function validateErrorProfile(value, field = 'errorProfile') {
  const code = 'ERROR_PROFILE_INVALID';
  const profile = objectAt(value, field, code);
  enumAt(profile.type, ERROR_TYPES, 'type', code);
  enumAt(profile.unitKind, ['word', 'grapheme', 'letter'], 'unitKind', code);
  stringAt(profile, 'unitId', code);
  integerAt(profile, 'position', code);
  if (typeof profile.expected !== 'string') fail(code, 'expected must be a string', 'expected');
  if (typeof profile.actual !== 'string') fail(code, 'actual must be a string', 'actual');
  return true;
}

/**
 * @param {unknown} value
 * @param {string} [field]
 * @returns {true}
 */
export function validateAttemptResult(value, field = 'attemptResult') {
  const code = 'ATTEMPT_RESULT_INVALID';
  const result = objectAt(value, field, code);
  stringAt(result, 'specId', code);
  stringAt(result, 'wordId', code);
  booleanAt(result, 'wordCorrect', code);
  if (result.focusCorrect !== undefined) booleanAt(result, 'focusCorrect', code);
  if (result.firstError !== undefined && result.firstError !== null) {
    validateErrorProfile(result.firstError, 'firstError');
  }
  if (!Number.isFinite(result.timestamp) || /** @type {number} */ (result.timestamp) < 0) {
    fail(code, 'timestamp must be a non-negative epoch-ms number', 'timestamp');
  }
  return true;
}

/**
 * @param {unknown} value
 * @param {string} [field]
 * @returns {true}
 */
export function validateWordState(value, field = 'wordState') {
  const code = 'WORD_STATE_INVALID';
  const state = objectAt(value, field, code);
  stringAt(state, 'wordId', code);
  integerAt(state, 'intervalIndex', code);
  integerAt(state, 'consecutiveCorrect', code);
  enumAt(state.lastResult, LAST_RESULTS, 'lastResult', code);
  if (!Array.isArray(state.errorProfile)) fail(code, 'errorProfile must be an array', 'errorProfile');
  if (state.errorProfile.length > MAX_ERROR_PROFILE_ENTRIES) {
    fail(code, `errorProfile must hold at most ${MAX_ERROR_PROFILE_ENTRIES} entries`, 'errorProfile');
  }
  state.errorProfile.forEach((profile, index) => validateErrorProfile(profile, `errorProfile[${index}]`));
  enumAt(state.status, WORD_STATUS, 'status', code);
  if (state.dueDate !== null && !isDayKey(state.dueDate)) {
    fail(code, 'dueDate must be YYYY-MM-DD or null', 'dueDate');
  }
  if (state.updatedAt !== undefined && typeof state.updatedAt !== 'string') {
    fail(code, 'updatedAt must be an ISO string when present', 'updatedAt');
  }
  return true;
}

/**
 * @param {unknown} value
 * @param {string} [field]
 * @returns {true}
 */
export function validateGraphemeState(value, field = 'graphemeState') {
  const code = 'GRAPHEME_STATE_INVALID';
  const state = objectAt(value, field, code);
  stringAt(state, 'graphemeId', code);
  integerAt(state, 'intervalIndex', code);
  integerAt(state, 'consecutiveCorrect', code);
  if (!Array.isArray(state.wordsPassed)) fail(code, 'wordsPassed must be an array', 'wordsPassed');
  state.wordsPassed.forEach((wordId, index) => {
    if (typeof wordId !== 'string' || wordId.length === 0) {
      fail(code, `wordsPassed[${index}] must be a non-empty string`, `wordsPassed[${index}]`);
    }
  });
  enumAt(state.status, GRAPHEME_STATUS, 'status', code);
  if (state.dueDate !== null && !isDayKey(state.dueDate)) {
    fail(code, 'dueDate must be YYYY-MM-DD or null', 'dueDate');
  }
  if (state.lastResult !== undefined) {
    enumAt(state.lastResult, LAST_RESULTS, 'lastResult', code);
  }
  if (state.updatedAt !== undefined && typeof state.updatedAt !== 'string') {
    fail(code, 'updatedAt must be an ISO string when present', 'updatedAt');
  }
  return true;
}

/**
 * @param {unknown} type
 * @returns {type is string}
 */
export function isErrorType(type) {
  return typeof type === 'string' && ERROR_TYPES.includes(type);
}
