/**
 * @layer ui
 * @phase P9
 * @doc §2.1 孩子端（学习模块）
 *
 * 提示词优先级：句子 → 音标 → 中文翻译 → 单词保底。
 * 只读内容字段，不参与判定。
 */

/**
 * @param {{
 *   word: Record<string, any>,
 *   sentences?: Record<string, any>[]|Record<string, any>|null
 * }} input
 * @returns {{kind: 'sentence'|'phonetic'|'translation'|'word', label: string, text: string}}
 */
export function selectPrompt({ word, sentences = [] }) {
  const list = Array.isArray(sentences) ? sentences : sentences ? [sentences] : [];
  const sentence = list.find((item) => typeof item?.text === 'string' && item.text.trim().length > 0);
  if (sentence) {
    return { kind: 'sentence', label: 'Sentence', text: sentence.text.trim() };
  }
  const phonetic = typeof word?.phonetic === 'string' ? word.phonetic.trim() : '';
  if (phonetic) return { kind: 'phonetic', label: 'Sounds', text: phonetic };
  const translation = typeof word?.translation === 'string' ? word.translation.trim() : '';
  if (translation) return { kind: 'translation', label: 'Meaning', text: translation };
  return { kind: 'word', label: 'Word', text: String(word?.text ?? '') };
}
