/**
 * @layer tests
 * @phase P9
 * @doc §2.1 孩子端（学习模块）
 */

import { selectRecallPrompt } from '../../src/ui/promptSelector.js';
import { assertEqual, test } from '../harness.js';

test('T-TYPE 回忆提示：不显示目标单词', () => {
  const word = { text: 'brother', translation: '兄弟', phonetic: '/ˈbrʌðə(r)/' };
  const prompt = selectRecallPrompt({ word });
  assertEqual(prompt.kind, 'translation');
  assertEqual(prompt.text.includes('brother'), false);
  assertEqual(selectRecallPrompt({ word: { text: 'brother', phonetic: word.phonetic } }).kind, 'phonetic');
  assertEqual(selectRecallPrompt({ word: { text: 'brother' } }).kind, 'none');
});
