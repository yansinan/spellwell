/**
 * @layer tests
 * @phase P2
 * @doc §5.3 存储层平移策略
 */

import { readFile } from 'node:fs/promises';
import { CONTENT_VERSION, importContent, readContentVersion } from '../../src/storage/contentImport.js';
import { MemoryAdapter } from '../../src/storage/MemoryAdapter.js';
import { assertDeepEqual, assertEqual, assertRejects, test } from '../harness.js';

async function loadContent() {
  const load = async (name) => JSON.parse(
    await readFile(new URL(`../../src/content/${name}.json`, import.meta.url), 'utf8'),
  );
  return {
    words: await load('words'),
    graphemes: await load('graphemes'),
    sentences: await load('sentences'),
    confusables: await load('confusables'),
    version: CONTENT_VERSION,
  };
}

async function createAdapter() {
  const adapter = new MemoryAdapter();
  await adapter.init();
  return adapter;
}

test('内容导入：首次写入 4 个内容库并记录 contentVersion', async () => {
  const adapter = await createAdapter();
  const content = await loadContent();
  const result = await importContent(adapter, content);

  assertEqual(result.seeded, true);
  assertEqual(result.version, CONTENT_VERSION);
  assertEqual(result.counts.words, 583);
  assertEqual(result.counts.graphemes, 96);
  assertEqual(result.counts.sentences, 4);
  assertEqual(result.counts.confusables, 2);
  assertEqual(await readContentVersion(adapter), CONTENT_VERSION);
  assertEqual((await adapter.get('words', 'w.fish')).text, 'fish');
  assertEqual((await adapter.get('meta', 'contentVersion')).value, CONTENT_VERSION);
});

test('内容导入：同一版本幂等跳过，不重复写', async () => {
  const adapter = await createAdapter();
  const content = await loadContent();
  await importContent(adapter, content);
  const second = await importContent(adapter, content);
  assertEqual(second.seeded, false);
  assertEqual(second.version, CONTENT_VERSION);
});

test('内容导入：版本变化时覆盖写入并更新 meta', async () => {
  const adapter = await createAdapter();
  const content = await loadContent();
  await importContent(adapter, { ...content, version: 1 });
  const result = await importContent(adapter, { ...content, version: 2 });
  assertEqual(result.seeded, true);
  assertEqual(result.version, 2);
  assertEqual(await readContentVersion(adapter), 2);
});

test('内容导入：非法内容在事务前拒绝，不污染 meta', async () => {
  const adapter = await createAdapter();
  const content = await loadContent();
  content.words = { items: [{ text: 'no-id' }] };
  await assertRejects(() => importContent(adapter, content), 'CONTENT_IMPORT_INVALID');
  assertEqual(await readContentVersion(adapter), null);
  assertDeepEqual(await adapter.query('words', {}), []);
});
