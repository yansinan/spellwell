/**
 * @layer scheduler
 * @phase P9
 * @doc §3.4 9 个题型注册表
 *
 * 为当次练习中的错题选择“另一种题型”，用于后半段即时强化。
 */

export const REPAIR_ALTERNATIVES = Object.freeze({
  'T-SEQUENCE': Object.freeze(['T-FILL', 'T-EDIT', 'T-REORDER']),
  'T-FILL': Object.freeze(['T-EDIT', 'T-SEQUENCE', 'T-TYPE']),
  'T-TYPE': Object.freeze(['T-EDIT', 'T-FILL', 'T-SEQUENCE']),
  'T-EDIT': Object.freeze(['T-FILL', 'T-SEQUENCE', 'T-TYPE']),
  'T-REORDER': Object.freeze(['T-SEQUENCE', 'T-EDIT', 'T-FILL']),
  'T-SEGMENT': Object.freeze(['T-FILL', 'T-EDIT', 'T-SEQUENCE']),
  'T-CLOZE': Object.freeze(['T-FILL', 'T-EDIT']),
  'T-JUDGE-FIX': Object.freeze(['T-EDIT', 'T-FILL']),
  'T-MATCH': Object.freeze(['T-FILL', 'T-EDIT']),
});

/**
 * @param {string} originalType
 * @param {string|undefined} errorType
 * @param {number|string} seed
 * @returns {string}
 */
export function chooseRepairType(originalType, errorType, seed) {
  let pool = [...(REPAIR_ALTERNATIVES[originalType] ?? ['T-EDIT', 'T-FILL'])];
  if (errorType === 'OMISSION') pool = ['T-FILL', ...pool.filter((type) => type !== 'T-FILL')];
  if (errorType === 'SUBSTITUTION') pool = ['T-EDIT', ...pool.filter((type) => type !== 'T-EDIT')];
  const filtered = pool.filter((type) => type !== originalType);
  // 错误类型优先，保证 OMISSION 先补骨架、SUBSTITUTION 先改错。
  return filtered[0] ?? 'T-EDIT';
}
