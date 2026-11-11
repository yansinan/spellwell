/**
 * @layer tests
 * @phase P7
 * @doc §2.3 内容后台
 */

import { readFile } from 'node:fs/promises';
import { autoSegment } from '../../src/admin/WordImporter.js';
import { assertDeepEqual, assertEqual, test } from '../harness.js';

const graphemes = JSON.parse(await readFile(new URL('../../src/content/graphemes.json', import.meta.url), 'utf8'));
const words = JSON.parse(await readFile(new URL('../../src/content/words.json', import.meta.url), 'utf8'));
const byText = Object.fromEntries(graphemes.items.map((item) => [item.text, item.id]));

test('切分修正：常见错误不再把后缀/词缀当任意位置组合', () => {
  assertDeepEqual(autoSegment('classroom', byText).map((unit) => unit.text), ['cl', 'a', 'ss', 'r', 'oo', 'm']);
  assertDeepEqual(autoSegment('different', byText).map((unit) => unit.text), ['d', 'i', 'ff', 'er', 'e', 'n', 't']);
  assertDeepEqual(autoSegment('desk', byText).map((unit) => unit.text), ['d', 'e', 'sk']);
  assertDeepEqual(autoSegment('yes', byText).map((unit) => unit.text), ['y', 'e', 's']);
  assertDeepEqual(autoSegment('table', byText).map((unit) => unit.text), ['t', 'a', 'ble']);
  assertDeepEqual(autoSegment('small', byText).map((unit) => unit.text), ['sm', 'all']);
});

test('基础词库：所有 units 拼接等于 text，且 grapheme 存在', () => {
  const graphemeIds = new Set(graphemes.items.map((item) => item.id));
  for (const word of words.items) {
    assertEqual(word.units.map((unit) => unit.text).join(''), word.text, word.text);
    for (const unit of word.units) {
      assertEqual(graphemeIds.has(unit.graphemeId), true, `${word.text}: ${unit.graphemeId}`);
    }
  }
});
