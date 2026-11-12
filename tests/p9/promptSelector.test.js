/**
 * @layer tests
 * @phase P9
 * @doc §2.1 孩子端（学习模块）
 */

import { selectPrompt } from '../../src/ui/promptSelector.js';
import { assertDeepEqual, test } from '../harness.js';

test('提示词：中文优先，音标同时作为辅助', () => {
  const word = { text: 'weather', phonetic: '/ˈweðər/', translation: '天气' };
  assertDeepEqual(selectPrompt({ word, sentences: [{ text: 'The weather is nice.' }] }), {
    kind: 'translation',
    label: 'Meaning',
    text: '天气',
    secondary: { kind: 'phonetic', label: 'Sounds', text: '/ˈweðər/' },
  });
  assertDeepEqual(selectPrompt({ word }), {
    kind: 'translation',
    label: 'Meaning',
    text: '天气',
    secondary: { kind: 'phonetic', label: 'Sounds', text: '/ˈweðər/' },
  });
});

test('提示词：低年级不单独用音标，后期才允许', () => {
  const word = { text: 'weather', phonetic: '/ˈweðər/' };
  assertDeepEqual(selectPrompt({ word }), {
    kind: 'word', label: 'Word', text: 'weather', secondary: null,
  });
  assertDeepEqual(selectPrompt({ word, allowIpaOnly: true }), {
    kind: 'phonetic', label: 'Sounds', text: '/ˈweðər/', secondary: null,
  });
});
