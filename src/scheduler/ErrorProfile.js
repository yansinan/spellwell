/**
 * @layer scheduler
 * @phase P0
 * @doc §3.3 关键数据结构
 *
 * 错误画像只记录“位置 + 类型”，不记录“你错了”。
 */

import {
  ERROR_TYPES,
  MAX_ERROR_PROFILE_ENTRIES,
  validateErrorProfile,
} from '../core/contracts.js';

export const ERROR_TYPE_LABELS = Object.freeze({
  OMISSION: '遗漏',
  SUBSTITUTION: '替换',
  TRANSPOSITION: '顺序颠倒',
  EXTRA: '多余',
  BOUNDARY_OVER_SEGMENT: '切分过细',
  BOUNDARY_UNDER_SEGMENT: '切分过粗',
  BOUNDARY_MISPLACED: '切分位置错',
  SUFFIX_RULE: '后缀规则',
  UNKNOWN: '未分类',
});

/**
 * @param {{
 *   type: string,
 *   unitKind?: 'word'|'grapheme'|'letter',
 *   unitId: string,
 *   position: number,
 *   expected: string,
 *   actual: string
 * }} input
 * @returns {import('../core/contracts.js').ErrorProfile}
 */
export function createErrorProfile(input) {
  const profile = {
    type: input.type,
    unitKind: input.unitKind ?? 'word',
    unitId: input.unitId,
    position: input.position,
    expected: input.expected,
    actual: input.actual,
  };
  validateErrorProfile(profile);
  return /** @type {import('../core/contracts.js').ErrorProfile} */ (profile);
}

/**
 * 追加错误画像：同 type + unitId + position 去重；最多保留 8 条（丢最旧）。
 * 返回新数组，不修改入参。
 * @param {import('../core/contracts.js').ErrorProfile[]} list
 * @param {import('../core/contracts.js').ErrorProfile} profile
 * @param {{max?: number}} [options]
 * @returns {import('../core/contracts.js').ErrorProfile[]}
 */
export function appendErrorProfile(list, profile, options = {}) {
  if (!Array.isArray(list)) throw new TypeError('errorProfile list must be an array');
  validateErrorProfile(profile);
  const max = options.max ?? MAX_ERROR_PROFILE_ENTRIES;
  if (!Number.isInteger(max) || max < 1) throw new RangeError('max must be a positive integer');

  const duplicate = list.some(
    (item) => item.type === profile.type
      && item.unitId === profile.unitId
      && item.position === profile.position,
  );
  const next = duplicate ? [...list] : [...list, profile];
  return next.slice(Math.max(0, next.length - max));
}

/**
 * 主错误：位置最靠前；位置相同按类型稳定排序。
 * @param {import('../core/contracts.js').ErrorProfile[]} list
 * @returns {import('../core/contracts.js').ErrorProfile|null}
 */
export function primaryError(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return [...list].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    const typeA = ERROR_TYPES.indexOf(a.type);
    const typeB = ERROR_TYPES.indexOf(b.type);
    return typeA - typeB;
  })[0];
}

/**
 * @param {import('../core/contracts.js').ErrorProfile[]} list
 * @param {string} type
 * @returns {import('../core/contracts.js').ErrorProfile[]}
 */
export function errorsForType(list, type) {
  return list.filter((item) => item.type === type);
}

/**
 * 家长端短句：具体到“哪个词的哪个块”，而不是正确率。
 * @param {import('../core/contracts.js').ErrorProfile} profile
 * @param {{wordText?: string, focusText?: string}} [context]
 * @returns {string}
 */
export function describeErrorForParent(profile, context = {}) {
  const label = ERROR_TYPE_LABELS[profile.type] ?? ERROR_TYPE_LABELS.UNKNOWN;
  const word = context.wordText ? `「${context.wordText}」` : '这个词';
  const expected = profile.expected ? `「${profile.expected}」` : '正确拼写';
  switch (profile.type) {
    case 'OMISSION':
      return `${word}第 ${profile.position + 1} 位遗漏了 ${expected}`;
    case 'SUBSTITUTION':
      return `${word}第 ${profile.position + 1} 位把 ${expected} 写成了「${profile.actual}」`;
    case 'TRANSPOSITION':
      return `${word}第 ${profile.position + 1} 位顺序颠倒（应为 ${expected}）`;
    case 'EXTRA':
      return `${word}第 ${profile.position + 1} 位多出了「${profile.actual}」`;
    case 'BOUNDARY_OVER_SEGMENT':
    case 'BOUNDARY_UNDER_SEGMENT':
    case 'BOUNDARY_MISPLACED':
      return `${word}的字母组合切分有误（${label}），目标块是 ${expected}`;
    case 'SUFFIX_RULE':
      return `${word}的后缀变化有误（应为 ${expected}）`;
    default:
      return `${word}第 ${profile.position + 1} 位需要再练一次`;
  }
}
