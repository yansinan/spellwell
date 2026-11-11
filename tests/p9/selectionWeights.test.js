/**
 * @layer tests
 * @phase P9
 * @doc §3.5 难度与权重
 */

import { calibrateWeights, scoreWord } from '../../src/scheduler/SelectionWeights.js';
import { assert, assertEqual, test } from '../harness.js';

test('真实权重：从 attempts 统计按词/题型错误率并平滑', () => {
  const weights = calibrateWeights([
    { wordId: 'w.fish', typeId: 'T-FILL', wordCorrect: false },
    { wordId: 'w.fish', typeId: 'T-FILL', wordCorrect: false },
    { wordId: 'w.ship', typeId: 'T-TYPE', wordCorrect: true },
  ]);
  assertEqual(weights.sampleSize, 3);
  assert(weights.byWord['w.fish'].errorRate > weights.byWord['w.ship'].errorRate);
  assert(weights.byType['T-FILL'].errorRate > weights.byType['T-TYPE'].errorRate);
  assert(weights.byWord['w.fish'].errorRate < 1);
});

test('真实权重：高错误率词在同层得分更高，Effort 更偏新词', () => {
  const weights = calibrateWeights([
    { wordId: 'w.fish', wordCorrect: false },
    { wordId: 'w.fish', wordCorrect: false },
    { wordId: 'w.ship', wordCorrect: true },
  ]);
  const state = { dueDate: '2026-11-20', intervalIndex: 1, errorProfile: [] };
  const fish = scoreWord({ word: { id: 'w.fish' }, state, weights, today: '2026-11-11', mode: 'review' });
  const ship = scoreWord({ word: { id: 'w.ship' }, state, weights, today: '2026-11-11', mode: 'review' });
  assert(fish > ship);
  const newReview = scoreWord({ word: { id: 'w.new' }, weights, today: '2026-11-11', mode: 'review' });
  const newEffort = scoreWord({ word: { id: 'w.new' }, weights, today: '2026-11-11', mode: 'effort' });
  assert(newEffort > newReview);
});
