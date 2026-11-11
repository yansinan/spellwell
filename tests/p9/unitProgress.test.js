/**
 * @layer tests
 * @phase P9
 * @doc §2.1 孩子端（学习模块）
 */

import { visibleUnitProgress } from '../../src/ui/unitProgress.js';
import { assertDeepEqual, assertEqual, test } from '../harness.js';

test('单元顺序解锁：完成 + 下一个，后续不显示', () => {
  const units = [
    { id: 'g1-s1-u2', grade: 1, term: '上', unit: 2, count: 5, completed: false },
    { id: 'g1-s1-u1', grade: 1, term: '上', unit: 1, count: 5, completed: true },
    { id: 'g1-s1-u3', grade: 1, term: '上', unit: 3, count: 5, completed: true },
  ];
  const result = visibleUnitProgress(units);
  assertDeepEqual(result.visible.map((unit) => unit.id), ['g1-s1-u1', 'g1-s1-u2']);
  assertEqual(result.current.id, 'g1-s1-u2');
  assertEqual(result.completed.length, 1);
});

test('单元顺序解锁：全部完成时显示全部已完成', () => {
  const units = [
    { id: 'a', grade: 1, term: '上', unit: 1, count: 5, completed: true },
    { id: 'b', grade: 1, term: '上', unit: 2, count: 5, completed: true },
  ];
  const result = visibleUnitProgress(units);
  assertEqual(result.visible.length, 2);
  assertEqual(result.current, null);
});
