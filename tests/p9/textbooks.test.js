/**
 * @layer tests
 * @phase P9
 * @doc §2.3 内容后台
 */

import { MemoryAdapter } from '../../src/storage/MemoryAdapter.js';
import { DEFAULT_TEXTBOOK, readActiveTextbook, saveActiveTextbook, textbookLabel } from '../../src/storage/textbooks.js';
import { importWord } from '../../src/admin/ContentEditor.js';
import { assertEqual, test } from '../harness.js';

test('教材版本：默认人教，可切换到外研并持久化', async () => {
  const adapter = new MemoryAdapter();
  await adapter.init();
  assertEqual(await readActiveTextbook(adapter), DEFAULT_TEXTBOOK);
  await saveActiveTextbook(adapter, 'fltrp-2026');
  assertEqual(await readActiveTextbook(adapter), 'fltrp-2026');
  assertEqual(textbookLabel('fltrp-2026'), '外研版新交际（北京专版）');
});

test('教材版本：同名单词在不同教材中保持独立', () => {
  const content = { words: { items: [] } };
  importWord(content, { id: 'w.fish', text: 'fish', units: [{ text: 'f', graphemeId: 'g.f' }], textbook: 'pep-2026' }, 'merge');
  importWord(content, { id: 'w.fltrp-fish', text: 'fish', units: [{ text: 'f', graphemeId: 'g.f' }], textbook: 'fltrp-2026' }, 'merge');
  assertEqual(content.words.items.length, 2);
  assertEqual(content.words.items[0].textbook, 'pep-2026');
  assertEqual(content.words.items[1].textbook, 'fltrp-2026');
});
