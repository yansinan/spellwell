/**
 * @layer tests
 * @phase P9
 * @doc §2.3 内容后台
 */

import { MemoryAdapter } from '../../src/storage/MemoryAdapter.js';
import { LearningStateService, deriveUnitStatus, placementState } from '../../src/admin/LearningStateService.js';
import { createWordState } from '../../src/repositories/StateRepository.js';
import { assertDeepEqual, assertEqual, test } from '../harness.js';

test('后台学习状态：unstarted/reviewing/mastered 的字段', () => {
  const base = createWordState('w.fish', new Date('2026-11-12T00:00:00Z'));
  const unstarted = placementState(base, 'unstarted', new Date('2026-11-12T00:00:00Z'));
  assertEqual(unstarted.intervalIndex, 0);
  assertEqual(unstarted.dueDate, null);
  const reviewing = placementState(base, 'reviewing', new Date('2026-11-12T00:00:00Z'));
  assertEqual(reviewing.status, 'reviewing');
  assertEqual(reviewing.dueDate, '2026-11-12');
  const mastered = placementState(base, 'mastered', new Date('2026-11-12T00:00:00Z'));
  assertEqual(mastered.status, 'mastered');
  assertEqual(mastered.dueDate, null);
  assertEqual(mastered.errorProfile.length, 0);
});

test('后台学习状态：单元批量写入并派生状态', async () => {
  const adapter = new MemoryAdapter();
  await adapter.init();
  const service = new LearningStateService(adapter);
  const words = [{ id: 'w.a' }, { id: 'w.b' }];
  await service.setUnitStatus(words, 'reviewing', new Date('2026-11-12T00:00:00Z'));
  const states = await service.load();
  assertEqual(states.get('w.a').status, 'reviewing');
  assertEqual(deriveUnitStatus(words, states), 'reviewing');
  await service.setWordStatus('w.b', 'mastered', new Date('2026-11-12T00:00:00Z'));
  assertEqual(deriveUnitStatus(words, await service.load()), 'mixed');
  assertDeepEqual((await service.load()).get('w.b').errorProfile, []);
});
