/**
 * @layer tests
 * @phase P12
 * @doc §5.3 存储层平移策略
 */

import { mergeSnapshots } from '../../src/sync/mergeSnapshots.js';
import { SCHEMA_VERSION } from '../../src/storage/schema.js';
import { assertDeepEqual, assertEqual, test } from '../harness.js';

function snapshot(stores = {}) {
  return { schemaVersion: SCHEMA_VERSION, exportedAt: 'x', stores };
}

test('快照合并：attempts 并集，状态取更新时间较新者', () => {
  const local = snapshot({
    attempts: [{ id: 'a1', wordId: 'w.a', timestamp: 1 }],
    wordStates: [{ wordId: 'w.a', updatedAt: '2026-01-01T00:00:00Z', intervalIndex: 1 }],
    meta: [{ key: 'contentRevision', value: 2 }, { key: 'speedHistory', value: { items: [{ at: 2, secondsPerQuestion: 2 }] } }],
  });
  const remote = snapshot({
    attempts: [{ id: 'a1', wordId: 'w.a', timestamp: 1 }, { id: 'a2', wordId: 'w.b', timestamp: 2 }],
    wordStates: [{ wordId: 'w.a', updatedAt: '2026-01-02T00:00:00Z', intervalIndex: 3 }],
    meta: [{ key: 'contentRevision', value: 3 }, { key: 'speedHistory', value: { items: [{ at: 1, secondsPerQuestion: 3 }] } }],
  });
  const merged = mergeSnapshots(local, remote);
  assertEqual(merged.stores.attempts.length, 2);
  assertEqual(merged.stores.wordStates[0].intervalIndex, 3);
  assertEqual(merged.stores.meta.find((item) => item.key === 'contentRevision').value, 3);
  assertEqual(merged.stores.meta.find((item) => item.key === 'speedHistory').value.items.length, 2);
});

test('快照合并：schema 不一致会拒绝', () => {
  let failed = false;
  try {
    mergeSnapshots(snapshot(), { schemaVersion: 999, stores: {} });
  } catch {
    failed = true;
  }
  assertEqual(failed, true);
});
