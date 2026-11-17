/**
 * @layer tests
 * @phase P12
 * @doc §5.3 存储层平移策略
 */

import { MemoryAdapter } from '../../src/storage/MemoryAdapter.js';
import { SyncManager } from '../../src/sync/SyncManager.js';
import { SYNC_STORAGE_KEYS } from '../../src/sync/SyncManager.js';
import { assertEqual, test } from '../harness.js';

function storageWithToken() {
  const values = new Map([[SYNC_STORAGE_KEYS.TOKEN, 'dev_test'], [SYNC_STORAGE_KEYS.BASE_URL, 'http://sync']]);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(body); },
  };
}

test('SyncManager：无远端时推送本地快照，成功后标记 synced', async () => {
  const adapter = new MemoryAdapter();
  await adapter.init();
  await adapter.put('words', { id: 'w.a', text: 'a' });
  let pushed = null;
  const fetchImpl = async (url, options = {}) => {
    if (url.endsWith('/v1/snapshots') && (!options.method || options.method === 'GET')) {
      return response(404, { error: 'not_found' });
    }
    if (url.endsWith('/v1/snapshots') && options.method === 'PUT') {
      pushed = JSON.parse(options.body);
      return response(201, { revision: 1, hash: 'h', snapshot: pushed.snapshot });
    }
    throw new Error(`unexpected ${url}`);
  };
  const manager = new SyncManager({ adapter, storage: storageWithToken(), fetchImpl, timeoutMs: 1000 });
  const result = await manager.syncOnce();
  assertEqual(result.state, 'synced');
  assertEqual(pushed.baseRevision, 0);
  assertEqual(pushed.snapshot.stores.words[0].id, 'w.a');
  assertEqual(manager.status.state, 'synced');
});

test('SyncManager：服务不可用时保持离线且不抛错', async () => {
  const adapter = new MemoryAdapter();
  await adapter.init();
  const manager = new SyncManager({
    adapter,
    storage: storageWithToken(),
    timeoutMs: 50,
    fetchImpl: async () => { throw new Error('connection refused'); },
  });
  const result = await manager.syncOnce();
  assertEqual(result.state, 'offline');
  assertEqual(manager.status.state, 'offline');
});

test('SyncManager：首次绑定以远端为准，成功后清除标记', async () => {
  const adapter = new MemoryAdapter();
  await adapter.init();
  await adapter.put('attempts', { id: 'local', wordId: 'w.local', timestamp: 99 });
  const storage = storageWithToken();
  storage.setItem(SYNC_STORAGE_KEYS.FIRST_BIND, '1');
  const remoteSnapshot = {
    schemaVersion: 1,
    exportedAt: '2026-01-01T00:00:00Z',
    stores: {
      words: [], graphemes: [], sentences: [], confusables: [],
      wordStates: [{ wordId: 'w.a', updatedAt: '2026-01-01T00:00:00Z', intervalIndex: 2 }],
      graphemeStates: [],
      attempts: [{ id: 'remote', wordId: 'w.a', timestamp: 1 }],
      meta: [],
    },
  };
  let pushed = null;
  const fetchImpl = async (url, options = {}) => {
    if (url.endsWith('/v1/snapshots') && (!options.method || options.method === 'GET')) {
      return response(200, { revision: 1, snapshot: remoteSnapshot });
    }
    if (url.endsWith('/v1/snapshots') && options.method === 'PUT') {
      pushed = JSON.parse(options.body);
      return response(201, { revision: 2, snapshot: pushed.snapshot });
    }
    throw new Error(`unexpected ${url}`);
  };
  const manager = new SyncManager({ adapter, storage, fetchImpl, timeoutMs: 1000 });
  await manager.syncOnce();
  assertEqual(pushed.baseRevision, 1);
  assertEqual(pushed.snapshot.stores.attempts.some((item) => item.id === 'local'), false);
  assertEqual((await adapter.query('wordStates', {}))[0].intervalIndex, 2);
  assertEqual(storage.getItem(SYNC_STORAGE_KEYS.FIRST_BIND), null);
});
