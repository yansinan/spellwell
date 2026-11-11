/**
 * @layer tests
 * @phase P7
 * @doc §2.3 内容后台
 */

import { readFile } from 'node:fs/promises';
import { applySegments } from '../../src/admin/ContentEditor.js';
import { autoSegment, parseBatch, parseWordLine } from '../../src/admin/WordImporter.js';
import { assertDeepEqual, assertEqual, assertThrows, test } from '../harness.js';

const graphemes = JSON.parse(await readFile(new URL('../../src/content/graphemes.json', import.meta.url), 'utf8'));
const byText = Object.fromEntries(graphemes.items.map((item) => [item.text, item.id]));

test('常见组合库：单字母 + digraph/vowel-team/r-controlled/suffix 已覆盖', () => {
  for (const text of ['a', 'z', 'th', 'sh', 'ch', 'ea', 'ee', 'igh', 'er', 'ar', 'tion', 'ough', 'ing']) {
    assertEqual(typeof byText[text], 'string', `missing grapheme ${text}`);
  }
  assertEqual(graphemes.items.length >= 90, true);
});

test('自动切分：weather → w/ea/th/er，常见词可复现', () => {
  assertDeepEqual(autoSegment('weather', byText).map((unit) => unit.text), ['w', 'ea', 'th', 'er']);
  assertDeepEqual(autoSegment('teacher', byText).map((unit) => unit.text), ['t', 'ea', 'ch', 'er']);
  assertDeepEqual(autoSegment('night', byText).map((unit) => unit.text), ['n', 'igh', 't']);
  assertDeepEqual(autoSegment('duck', byText).map((unit) => unit.text), ['d', 'u', 'ck']);
  assertDeepEqual(autoSegment('fish', byText).map((unit) => unit.text), ['f', 'i', 'sh']);
});

test('显式逗号切分：w,ea,th,er 录入 weather 并带中文/音标', () => {
  const entry = parseWordLine('w,ea,th,er | 天气 | /ˈweðər/', byText);
  assertEqual(entry.text, 'weather');
  assertDeepEqual(entry.units.map((unit) => unit.text), ['w', 'ea', 'th', 'er']);
  assertEqual(entry.translation, '天气');
  assertEqual(entry.phonetic, '/ˈweðər/');
  assertEqual(entry.units[1].graphemeId, 'g.ea');
});

test('批量解析：自动/显式混合，报告错误行', () => {
  const result = parseBatch('weather | 天气\nw,ea,th,er | 天气\nnot-a-word\nfish', byText);
  assertEqual(result.entries.length, 3);
  assertEqual(result.entries[0].text, 'weather');
  assertEqual(result.entries[1].text, 'weather');
  assertEqual(result.entries[2].text, 'fish');
  assertEqual(result.errors.length, 1);
});

test('切分应用：未知/非法 unit 明确报错', () => {
  const word = { text: 'weather', units: [] };
  applySegments(word, ['w', 'ea', 'th', 'er'], byText);
  assertEqual(word.units.length, 4);
  assertThrows(() => applySegments(word, ['w', 'zz'], byText), 'CONTENT_EDIT_INVALID');
});
