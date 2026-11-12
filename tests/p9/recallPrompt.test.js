/**
 * @layer tests
 * @phase P9
 * @doc §2.1 孩子端（学习模块）
 */

import { selectRecallPrompt } from '../../src/ui/promptSelector.js';
import { assertEqual, test } from '../harness.js';

test('T-TYPE 回忆提示：中文优先并附音标，不显示目标词', () => {
  const word = { text: 'brother', translation: '兄弟', phonetic: '/ˈbrʌðə(r)/' };
  const prompt = selectRecallPrompt({ word });
  assertEqual(prompt.kind, 'translation');
  assertEqual(prompt.text, '兄弟');
  assertEqual(prompt.text.includes('brother'), false);
  assertEqual(prompt.secondary.kind, 'phonetic');
  assertEqual(selectRecallPrompt({ word, allowIpaOnly: true }).secondary.kind, 'phonetic');
});

test('T-TYPE 回忆提示：无中文时低年级不单独给音标', () => {
  const word = { text: 'brother', phonetic: '/ˈbrʌðə(r)/' };
  assertEqual(selectRecallPrompt({ word }).kind, 'none');
  assertEqual(selectRecallPrompt({ word, allowIpaOnly: true }).kind, 'phonetic');
});
