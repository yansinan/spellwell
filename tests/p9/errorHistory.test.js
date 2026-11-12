/**
 * @layer tests
 * @phase P9
 * @doc §3.4 9 个题型注册表
 */

import { buildErrorHistory, historicalActuals } from '../../src/scheduler/ErrorHistory.js';
import { assertDeepEqual, assertEqual, test } from '../harness.js';

test('历史错误：同一词的历史 actual 优先于全局', () => {
  const history = buildErrorHistory([
    { wordId: 'bird', timestamp: '2026-01-01T00:00:00Z', firstError: { expected: 'ir', actual: 'ur' } },
    { wordId: 'bird', timestamp: '2026-01-02T00:00:00Z', firstError: { expected: 'ir', actual: 'er' } },
    { wordId: 'bird', timestamp: '2026-01-03T00:00:00Z', firstError: { expected: 'ir', actual: 'er' } },
    { wordId: 'girl', timestamp: '2026-01-04T00:00:00Z', firstError: { expected: 'ir', actual: 'ur' } },
  ]);
  assertDeepEqual(historicalActuals(history, { wordId: 'bird', expected: 'ir' }, 2), ['er', 'ur']);
  assertDeepEqual(historicalActuals(history, { wordId: 'girl', expected: 'ir' }, 2), ['ur', 'er']);
});

test('历史错误：跳过空 actual，保持跨词聚合', () => {
  const history = buildErrorHistory([
    { wordId: 'a', firstError: { expected: 'ea', actual: '' } },
    { wordId: 'a', firstError: { expected: 'ea', actual: 'e' } },
  ]);
  assertEqual(historicalActuals(history, { expected: 'ea' })[0], 'e');
});
