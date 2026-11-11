/**
 * @layer scheduler
 * @phase P0
 * @doc §3.4 9 个题型注册表
 *
 * 错误类型 → 修复题型的静态偏好。选择必须由 seed 决定，保证可复现。
 */

import { ERROR_TYPES } from '../core/contracts.js';
import { createRng } from '../core/seedRandom.js';
import { QUESTION_TYPE_IDS } from '../questionTypes/registry.js';

export const NEW_WORD_ROTATION = Object.freeze(['T-SEQUENCE', 'T-FILL', 'T-TYPE']);

/** @type {Readonly<Record<string, readonly string[]>>} */
export const REPAIR_PREFERENCE = Object.freeze({
  OMISSION: Object.freeze(['T-FILL', 'T-EDIT', 'T-SEGMENT']),
  SUBSTITUTION: Object.freeze(['T-EDIT', 'T-SEQUENCE', 'T-FILL']),
  TRANSPOSITION: Object.freeze(['T-REORDER', 'T-EDIT']),
  EXTRA: Object.freeze(['T-EDIT', 'T-FILL']),
  BOUNDARY_OVER_SEGMENT: Object.freeze(['T-SEGMENT', 'T-FILL', 'T-MATCH']),
  BOUNDARY_UNDER_SEGMENT: Object.freeze(['T-SEGMENT', 'T-FILL', 'T-MATCH']),
  BOUNDARY_MISPLACED: Object.freeze(['T-SEGMENT', 'T-REORDER', 'T-FILL']),
  SUFFIX_RULE: Object.freeze(['T-EDIT', 'T-FILL', 'T-TYPE']),
  UNKNOWN: Object.freeze(['T-SEQUENCE', 'T-FILL', 'T-TYPE']),
});

// 静态映射必须覆盖全部错误类型，且只能引用注册表里存在的题型。
for (const errorType of ERROR_TYPES) {
  const types = REPAIR_PREFERENCE[errorType];
  if (!types || types.length === 0) {
    throw new Error(`TypeSelector is missing a repair mapping for ${errorType}`);
  }
  for (const typeId of types) {
    if (!QUESTION_TYPE_IDS.includes(typeId)) {
      throw new Error(`TypeSelector maps ${errorType} to unknown type ${typeId}`);
    }
  }
}

/**
 * @param {string} errorType
 * @returns {readonly string[]}
 */
export function candidatesForError(errorType) {
  return REPAIR_PREFERENCE[errorType] ?? REPAIR_PREFERENCE.UNKNOWN;
}

/**
 * @param {string[]|null|undefined} available
 * @param {readonly string[]} pool
 * @returns {string[]}
 */
function filterAvailable(pool, available) {
  if (available === undefined || available === null) return [...pool];
  if (!Array.isArray(available)) throw new TypeError('available must be an array or null');
  return pool.filter((typeId) => available.includes(typeId));
}

/**
 * @param {{errorType: string, seed: number|string, available?: string[]|null}} input
 * @returns {string|null} 无可选题型时返回 null（由调用方决定降级或报错）
 */
export function selectType({ errorType, seed, available = null }) {
  let pool = filterAvailable(candidatesForError(errorType), available);
  if (pool.length === 0) {
    pool = filterAvailable(REPAIR_PREFERENCE.UNKNOWN, available);
  }
  if (pool.length === 0) return null;
  return createRng(seed).pick(pool);
}

/**
 * @param {{seed: number|string, available?: string[]|null}} input
 * @returns {string|null}
 */
export function selectForNewWord({ seed, available = null }) {
  const pool = filterAvailable(NEW_WORD_ROTATION, available);
  if (pool.length === 0) return null;
  return createRng(seed).pick(pool);
}
