/**
 * @layer scheduler
 * @phase P9
 * @doc §3.4 9 个题型注册表
 *
 * 常见相似音/相似拼写组合。仅用于生成干扰项，不参与判定，不修改内容。
 */

export const CONFUSABLE_GROUPS = Object.freeze([
  Object.freeze(['ir', 'er', 'ur']),
  Object.freeze(['ar', 'or', 'oar', 'ore']),
  Object.freeze(['air', 'ear', 'eer', 'are']),
  Object.freeze(['ea', 'ee', 'ey', 'ie', 'e', 'a']),
  Object.freeze(['ai', 'ay', 'a']),
  Object.freeze(['oa', 'ow', 'oe', 'o']),
  Object.freeze(['ou', 'ow', 'oo', 'o']),
  Object.freeze(['oi', 'oy']),
  Object.freeze(['oo', 'ue', 'ew', 'u']),
  Object.freeze(['au', 'aw']),
  Object.freeze(['igh', 'ie', 'i']),
  Object.freeze(['ch', 'sh', 'tch']),
  Object.freeze(['th', 's']),
  Object.freeze(['ck', 'k', 'c']),
  Object.freeze(['ph', 'f']),
  Object.freeze(['wh', 'w']),
  Object.freeze(['kn', 'n']),
  Object.freeze(['wr', 'r']),
  Object.freeze(['dge', 'ge']),
  Object.freeze(['mb', 'm']),
  Object.freeze(['tion', 'sion']),
  Object.freeze(['able', 'ible']),
  Object.freeze(['ance', 'ence']),
]);

const BY_TEXT = new Map();
for (const group of CONFUSABLE_GROUPS) {
  for (const text of group) {
    const set = BY_TEXT.get(text) ?? new Set();
    for (const other of group) if (other !== text) set.add(other);
    BY_TEXT.set(text, set);
  }
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function confusableTexts(text) {
  return [...(BY_TEXT.get(String(text)) ?? [])];
}

/**
 * @param {string} text
 * @param {{id: string, text: string}[]} pool
 * @returns {{id: string, text: string}[]}
 */
export function confusableGraphemes(text, pool) {
  const wanted = new Set(confusableTexts(text));
  return (Array.isArray(pool) ? pool : []).filter((item) => wanted.has(item.text));
}
