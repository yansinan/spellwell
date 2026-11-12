/**
 * @layer tests
 * @phase P9
 * @doc §3.4 9 个题型注册表
 */

import { variedType } from '../../src/scheduler/TypeVariety.js';
import { assert, assertEqual, test } from '../harness.js';

test('题型轮转：强复习在 T-TYPE/T-FILL 间交替', () => {
  const types = Array.from({ length: 20 }, (_, index) => variedType({
    phase: 'review', intervalIndex: 3, mode: 'review', index, seed: 42,
  }));
  const counts = types.reduce((map, type) => map.set(type, (map.get(type) ?? 0) + 1), new Map());
  assertEqual(counts.get('T-TYPE') <= 11, true);
  assertEqual(counts.get('T-FILL') >= 9, true);
  assertEqual(types.includes('T-SEQUENCE'), false);
});

test('题型轮转：新词仍以搭建为主，努力模式用填空', () => {
  assertEqual(variedType({ phase: 'new', mode: 'review', index: 0, seed: 1 }), 'T-SEQUENCE');
  assertEqual(variedType({ phase: 'new', mode: 'review', index: 2, seed: 1 }), 'T-FILL');
  assertEqual(variedType({ phase: 'new', mode: 'effort', index: 0, seed: 1 }), 'T-FILL');
});
