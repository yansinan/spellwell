/**
 * @layer tests
 * @phase P9
 * @doc §2.1 孩子端（学习模块）
 */

import { selectPrompt } from '../../src/ui/promptSelector.js';
import { assertDeepEqual, test } from '../harness.js';

test('提示词优先级：句子 → 音标 → 中文 → 单词', () => {
  const word = { text: 'weather', phonetic: '/ˈweðər/', translation: '天气' };
  assertDeepEqual(selectPrompt({ word, sentences: [{ text: 'The weather is nice.' }] }), {
    kind: 'sentence', label: 'Sentence', text: 'The weather is nice.',
  });
  assertDeepEqual(selectPrompt({ word }), {
    kind: 'phonetic', label: 'Sounds', text: '/ˈweðər/',
  });
  assertDeepEqual(selectPrompt({ word: { text: 'weather', translation: '天气' } }), {
    kind: 'translation', label: 'Meaning', text: '天气',
  });
  assertDeepEqual(selectPrompt({ word: { text: 'weather' } }), {
    kind: 'word', label: 'Word', text: 'weather',
  });
});
