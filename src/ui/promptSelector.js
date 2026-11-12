/**
 * @layer ui
 * @phase P9
 * @doc §2.1 孩子端（学习模块）
 *
 * 提示策略：
 * - 中文语义为主；
 * - 中文出现时同屏附音标，帮助熟悉 IPA；
 * - 不单独用音标提示低年级；
 * - 句子提示只用于 T-CLOZE；单词只作为最后保底。
 */

function phoneticPart(word) {
  const phonetic = typeof word?.phonetic === 'string' ? word.phonetic.trim() : '';
  return phonetic ? { kind: 'phonetic', label: 'Sounds', text: phonetic } : null;
}

/**
 * @param {{
 *   word: Record<string, any>,
 *   sentences?: Record<string, any>[]|Record<string, any>|null,
 *   allowIpaOnly?: boolean
 * }} input
 * @returns {{
 *   kind: 'sentence'|'phonetic'|'translation'|'word',
 *   label: string,
 *   text: string,
 *   secondary?: {kind: 'phonetic', label: string, text: string}|null
 * }}
 */
export function selectPrompt({ word, sentences = [], allowIpaOnly = false }) {
  const list = Array.isArray(sentences) ? sentences : sentences ? [sentences] : [];
  const translation = typeof word?.translation === 'string' ? word.translation.trim() : '';
  const phonetic = phoneticPart(word);
  if (translation) {
    return { kind: 'translation', label: 'Meaning', text: translation, secondary: phonetic };
  }
  if (phonetic && allowIpaOnly) return { ...phonetic, secondary: null };
  const sentence = list.find((item) => typeof item?.text === 'string' && item.text.trim().length > 0);
  if (sentence) {
    return { kind: 'sentence', label: 'Sentence', text: sentence.text.trim(), secondary: null };
  }
  return { kind: 'word', label: 'Word', text: String(word?.text ?? ''), secondary: null };
}

/**
 * T-TYPE 专用回忆提示：不显示目标单词本身。
 * 中文优先；音标作为同屏辅助。低年级不允许纯音标提示。
 * @param {{word: Record<string, any>, allowIpaOnly?: boolean}} input
 * @returns {{
 *   kind: 'phonetic'|'translation'|'none',
 *   label: string,
 *   text: string,
 *   secondary?: {kind: 'phonetic', label: string, text: string}|null
 * }}
 */
export function selectRecallPrompt({ word, allowIpaOnly = false }) {
  const translation = typeof word?.translation === 'string' ? word.translation.trim() : '';
  const phonetic = phoneticPart(word);
  if (translation) {
    return { kind: 'translation', label: 'Meaning', text: translation, secondary: phonetic };
  }
  if (phonetic && allowIpaOnly) return { ...phonetic, secondary: null };
  return { kind: 'none', label: '', text: '', secondary: null };
}
