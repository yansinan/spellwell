/**
 * @layer tests
 * @phase P2
 * @doc §5.3 存储层平移策略
 */

import { IndexedDBAdapter } from '../../src/storage/IndexedDBAdapter.js';
import { assertStorageAdapter, STORAGE_METHODS } from '../../src/storage/StorageAdapter.js';
import { assertDeepEqual, assertEqual, assertRejects, test } from '../harness.js';

test('IndexedDBAdapter：结构满足 7 方法存储契约', () => {
  const adapter = new IndexedDBAdapter();
  assertEqual(assertStorageAdapter(adapter), adapter);
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

test('IndexedDBAdapter：没有 IndexedDB 时明确报 STORAGE_UNAVAILABLE', async () => {
  const adapter = new IndexedDBAdapter({ factory: null });
  const error = await assertRejects(() => adapter.init(), 'STORAGE_UNAVAILABLE');
  assertEqual(error.code, 'STORAGE_UNAVAILABLE');
});

test('IndexedDBAdapter：未 init 时访问数据明确报 STORAGE_NOT_INITIALIZED', async () => {
  const adapter = new IndexedDBAdapter({ factory: null });
  await assertRejects(() => adapter.get('words', 'w.fish'), 'STORAGE_NOT_INITIALIZED');
});
