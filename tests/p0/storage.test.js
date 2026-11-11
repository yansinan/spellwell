/**
 * @layer tests
 * @phase P0
 * @doc §5.3 存储层平移策略
 */

import { IndexedDBAdapter } from '../../src/storage/IndexedDBAdapter.js';
import { MemoryAdapter } from '../../src/storage/MemoryAdapter.js';
import { assertStorageAdapter, STORAGE_METHODS } from '../../src/storage/StorageAdapter.js';
import { SCHEMA_VERSION, STORE_NAMES } from '../../src/storage/schema.js';
import {
  assert,
  assertDeepEqual,
  assertEqual,
  assertRejects,
  assertThrows,
  test,
} from '../harness.js';

async function createAdapter(initialData) {
  const adapter = new MemoryAdapter(initialData ? { initialData } : {});
  await adapter.init();
  return adapter;
}

test('StorageAdapter：精确冻结 7 个存储方法', () => {
  assertDeepEqual([...STORAGE_METHODS], [
    'init',
    'get',
    'put',
    'query',
    'transaction',
    'exportAll',
    'importAll',
  ]);
});

test('schema：8 个集合与索引定义完整', () => {
  assertDeepEqual([...STORE_NAMES], [
    'words',
    'graphemes',
    'sentences',
    'confusables',
    'wordStates',
    'graphemeStates',
    'attempts',
    'meta',
  ]);
});

test('MemoryAdapter：init 幂等，未初始化时拒绝访问', async () => {
  const adapter = new MemoryAdapter();
  await assertRejects(async () => adapter.get('words', 'w.a'), 'STORAGE_NOT_INITIALIZED');
  await adapter.init();
  await adapter.init();
  assertEqual(await adapter.get('words', 'w.a'), undefined);
});

test('MemoryAdapter：put/get 返回克隆，外部修改不影响存储', async () => {
  const adapter = await createAdapter();
  const record = { id: 'w.cat', text: 'cat', units: [{ text: 'c', graphemeId: 'g.c' }] };
  const written = await adapter.put('words', record);
  record.text = 'mutated';
  written.units[0].text = 'mutated';
  const loaded = await adapter.get('words', 'w.cat');
  assertEqual(loaded.text, 'cat');
  assertEqual(loaded.units[0].text, 'c');
  loaded.text = 'changed again';
  assertEqual((await adapter.get('words', 'w.cat')).text, 'cat');
});

test('MemoryAdapter：query 按主键稳定排序，支持等值过滤与分页', async () => {
  const adapter = await createAdapter();
  await adapter.put('words', { id: 'w.c', level: 1, text: 'c' });
  await adapter.put('words', { id: 'w.a', level: 1, text: 'a' });
  await adapter.put('words', { id: 'w.b', level: 2, text: 'b' });

  assertDeepEqual((await adapter.query('words')).map((item) => item.id), ['w.a', 'w.b', 'w.c']);
  assertDeepEqual((await adapter.query('words', { where: { level: 1 } })).map((item) => item.id), ['w.a', 'w.c']);
  assertDeepEqual((await adapter.query('words', { limit: 2 })).map((item) => item.id), ['w.a', 'w.b']);
  assertDeepEqual((await adapter.query('words', { offset: 1, limit: 1 })).map((item) => item.id), ['w.b']);
});

test('MemoryAdapter：未知集合、非法记录与非法 query 参数均拒绝', async () => {
  const adapter = await createAdapter();
  await assertRejects(async () => adapter.get('nope', 'x'), 'STORAGE_STORE_UNKNOWN');
  await assertRejects(async () => adapter.put('words', { text: 'no id' }), 'STORAGE_RECORD_INVALID');
  await assertRejects(async () => adapter.query('words', { limit: -1 }), 'STORAGE_QUERY_INVALID');
});

test('MemoryAdapter：事务成功提交，异常时完整回滚', async () => {
  const adapter = await createAdapter();
  await adapter.put('words', { id: 'w.a', text: 'a' });

  const result = await adapter.transaction(['words'], async (tx) => {
    await tx.put('words', { id: 'w.b', text: 'b' });
    return 'committed';
  });
  assertEqual(result, 'committed');
  assertEqual((await adapter.get('words', 'w.b')).text, 'b');

  await assertRejects(
    () => adapter.transaction(['words'], async (tx) => {
      await tx.put('words', { id: 'w.c', text: 'c' });
      throw new Error('boom');
    }),
    /boom/,
  );
  assertEqual(await adapter.get('words', 'w.c'), undefined);
  assertEqual((await adapter.get('words', 'w.b')).text, 'b');
});

test('MemoryAdapter：exportAll/importAll 往返后数据一致', async () => {
  const source = await createAdapter({
    words: [{ id: 'w.fish', text: 'fish', level: 1 }],
    graphemes: [{ id: 'g.sh', text: 'sh', tier: 'T1' }],
    wordStates: [{
      wordId: 'w.fish',
      intervalIndex: 0,
      consecutiveCorrect: 0,
      lastResult: null,
      errorProfile: [],
      status: 'learning',
      dueDate: '2026-11-11',
    }],
  });
  const snapshot = await source.exportAll();
  assertEqual(snapshot.schemaVersion, SCHEMA_VERSION);

  const target = await createAdapter();
  const { imported } = await target.importAll(snapshot);
  assertEqual(imported, 3);
  const reExported = await target.exportAll();
  assertDeepEqual(reExported.stores, snapshot.stores);
});

test('MemoryAdapter：importAll 拒绝版本不匹配与未知集合', async () => {
  const adapter = await createAdapter();
  await assertRejects(
    () => adapter.importAll({ schemaVersion: 999, stores: {} }),
    'STORAGE_IMPORT_SCHEMA_MISMATCH',
  );
  await assertRejects(
    () => adapter.importAll({ schemaVersion: SCHEMA_VERSION, stores: { nope: [] } }),
    'STORAGE_IMPORT_INVALID',
  );
});

test('assertStorageAdapter：缺少任一方法即拒绝', () => {
  const adapter = new MemoryAdapter();
  assertEqual(assertStorageAdapter(adapter), adapter);
  assertThrows(() => assertStorageAdapter({}), 'STORAGE_ADAPTER_INVALID');
  assertThrows(
    () => assertStorageAdapter({ ...adapter, query: undefined }),
    'STORAGE_ADAPTER_INVALID',
  );
});

test('IndexedDBAdapter：Node 无 IndexedDB 时明确报 STORAGE_UNAVAILABLE', async () => {
  const adapter = new IndexedDBAdapter();
  const error = await assertRejects(() => adapter.init(), 'STORAGE_UNAVAILABLE');
  assertEqual(error.code, 'STORAGE_UNAVAILABLE');
  assert(error instanceof Error);
});
