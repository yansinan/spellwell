/**
 * @layer tests
 * @phase P7
 * @doc §2.3 内容后台
 */

import { addUnit, addWord, cloneContent, deleteWord, importWord, nextWordId, removeUnit, updateUnit, updateWord } from '../../src/admin/ContentEditor.js';
import { assertDeepEqual, assertEqual, assertThrows, test } from '../harness.js';

function base() {
  return {
    words: { version: 1, items: [{ id: 'w.fish', text: 'fish', units: [{ text: 'f', graphemeId: 'g.f' }], level: 1, reviewStatus: 'unreviewed' }] },
    graphemes: { version: 1, items: [{ id: 'g.f', text: 'f' }, { id: 'g.sh', text: 'sh' }] },
    sentences: { version: 1, items: [] },
    confusables: { version: 1, items: [] },
  };
}

test('后台编辑：新增单词 ID 稳定且不重复', () => {
  const content = base();
  assertEqual(nextWordId(content, 'ship'), 'w.ship');
  addWord(content, { id: 'w.ship', text: 'ship', units: [], level: 1, reviewStatus: 'unreviewed' });
  assertEqual(nextWordId(content, 'ship'), 'w.ship-2');
  assertThrows(() => addWord(content, { id: 'w.ship', text: 'ship' }), 'CONTENT_EDIT_DUPLICATE');
});

test('后台编辑：增删改 unit 并保留人工切分', () => {
  const content = base();
  const word = content.words.items[0];
  updateWord(content, 'w.fish', { text: 'fish', reviewStatus: 'reviewed' });
  addUnit(word, { text: 'i', graphemeId: 'g.f' });
  addUnit(word, { text: 'sh', graphemeId: 'g.sh' });
  updateUnit(word, 1, { text: 'i', graphemeId: 'g.f' });
  removeUnit(word, 0);
  assertDeepEqual(word.units, [{ text: 'i', graphemeId: 'g.f' }, { text: 'sh', graphemeId: 'g.sh' }]);
  assertEqual(content.words.items[0].reviewStatus, 'reviewed');
  assertEqual(cloneContent(content) === content, false);
  deleteWord(content, 'w.fish');
  assertEqual(content.words.items.length, 0);
});

test('重复词合并/替换/跳过：保留稳定 ID，merge 不覆盖人工切分', () => {
  const content = base();
  const original = content.words.items[0];
  const entry = { text: 'fish', units: [{ text: 'f', graphemeId: 'g.f' }, { text: 'i', graphemeId: 'g.f' }, { text: 'sh', graphemeId: 'g.sh' }], translation: '鱼', phonetic: '/fɪʃ/' };
  assertEqual(importWord(content, entry, 'merge'), 'merged');
  assertEqual(content.words.items.length, 1);
  assertDeepEqual(original.units, [{ text: 'f', graphemeId: 'g.f' }]);
  assertEqual(original.translation, '鱼');
  assertEqual(original.phonetic, '/fɪʃ/');

  assertEqual(importWord(content, entry, 'replace'), 'replaced');
  assertEqual(original.units.length, 3);
  assertEqual(original.reviewStatus, 'unreviewed');
  assertEqual(importWord(content, entry, 'skip'), 'skipped');
});
