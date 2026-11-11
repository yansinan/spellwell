/**
 * @layer tests
 * @phase P7
 * @doc §2.3 内容后台
 */

import { applyWordLibrary, buildWordLibrary, parseWordLibrary } from '../../src/admin/WordLibrary.js';
import { assertDeepEqual, assertEqual, test } from '../harness.js';

const scope = { grade: 1, term: '下', unit: 1, unitId: 'g1-s2-u1', unitLabel: '一年级下 · 第1单元' };
const units = [{ text: 'f', graphemeId: 'g.f' }, { text: 'ish', graphemeId: 'g.ish' }];

function base() {
  return {
    words: {
      items: [{ id: 'w.fish', text: 'fish', units, translation: '鱼', phonetic: '', ...scope, reviewStatus: 'unreviewed' }],
    },
  };
}

test('词库导出：schema + words，不包含学习状态', () => {
  const content = base();
  const library = buildWordLibrary(content.words.items, { exportedAt: '2026-11-12T00:00:00.000Z' });
  assertEqual(library.schema, 'spellwell.words.v1');
  assertEqual(library.items.length, 1);
  assertEqual(library.items[0].text, 'fish');
  assertEqual('wordStates' in library, false);
  assertEqual(parseWordLibrary(library).items.length, 1);
});

test('词库导入：新增/合并/替换/不动', () => {
  const content = base();
  const entry = { ...scope, id: 'w.fish2', text: 'fish', units, translation: '鱼肉', phonetic: '/fɪʃ/' };
  assertDeepEqual(applyWordLibrary(content, [entry], 'skip'), { created: 0, merged: 0, replaced: 0, skipped: 1, errors: [] });
  assertEqual(applyWordLibrary(content, [entry], 'merge').merged, 1);
  assertEqual(content.words.items[0].translation, '鱼');
  assertEqual(applyWordLibrary(content, [entry], 'replace').replaced, 1);
  assertEqual(content.words.items[0].translation, '鱼肉');

  const created = applyWordLibrary(content, [{ ...entry, id: 'w.weather', text: 'weather', units: [{ text: 'w', graphemeId: 'g.w' }] }], 'merge');
  assertEqual(created.created, 1);
  assertEqual(content.words.items.some((word) => word.id === 'w.weather'), true);
});

test('词库文件：非法 JSON / 缺少 units 被拒绝', () => {
  assertEqual(parseWordLibrary('{bad').errors.length, 1);
  assertEqual(parseWordLibrary({ items: [{ text: 'fish' }] }).errors.length, 1);
});
