/**
 * @layer tests
 * @phase P9
 * @doc §2.1 孩子端（学习模块）
 */

import { selectAutoUnits, visibleUnitProgress } from '../../src/ui/unitProgress.js';
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

test('自动练习：选所有未掌握复习单元，不选已掌握', () => {
  const units = [
    { id: 'done', grade: 1, term: '上', unit: 1, count: 5, practiced: 5, completed: true, mastered: true },
    { id: 'review1', grade: 1, term: '上', unit: 2, count: 8, practiced: 8, completed: true, mastered: false },
    { id: 'partial', grade: 1, term: '上', unit: 3, count: 6, practiced: 2, completed: false, mastered: false },
    { id: 'new', grade: 1, term: '上', unit: 4, count: 6, practiced: 0, completed: false, mastered: false },
  ];
  const result = selectAutoUnits(units, 20);
  assertDeepEqual(result.selected.map((unit) => unit.id), ['review1', 'partial']);
  assertEqual(result.autoStart, true);
});

test('自动练习：复习单元完成后有余地才加新单元', () => {
  const units = [
    { id: 'review', grade: 1, term: '上', unit: 1, count: 8, practiced: 8, completed: true, mastered: false },
    { id: 'new', grade: 1, term: '上', unit: 2, count: 6, practiced: 0, completed: false, mastered: false },
  ];
  const result = selectAutoUnits(units, 20);
  assertDeepEqual(result.selected.map((unit) => unit.id), ['review', 'new']);
});
