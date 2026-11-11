/**
 * @layer tests
 * @phase P1
 * @doc §6.2 UI 风格参考：多邻国
 */

import { distanceToRect, findNearestSlot } from '../../src/ui/dragGeometry.js';
import { assertEqual, test } from '../harness.js';

const slots = [
  { index: 0, rect: { left: 0, top: 0, width: 60, height: 60 } },
  { index: 1, rect: { left: 80, top: 0, width: 60, height: 60 } },
];

test('拖拽几何：点在矩形内距离为 0，边缘外按最近边计算', () => {
  assertEqual(distanceToRect({ x: 30, y: 30 }, slots[0].rect), 0);
  assertEqual(distanceToRect({ x: 70, y: 30 }, slots[0].rect), 10);
  assertEqual(distanceToRect({ x: 30, y: 80 }, slots[0].rect), 20);
  assertEqual(distanceToRect({ x: 30, y: 30 }, slots[1].rect), 50);
});

test('拖拽几何：吸附半径内选择最近槽位', () => {
  assertEqual(findNearestSlot(slots, { x: 65, y: 30 }, 64).index, 0);
  assertEqual(findNearestSlot(slots, { x: 75, y: 30 }, 64).index, 1);
  assertEqual(findNearestSlot(slots, { x: 100, y: 30 }, 64).index, 1);
});

test('拖拽几何：超出吸附半径返回 null，不会误吸附', () => {
  assertEqual(findNearestSlot(slots, { x: 300, y: 300 }, 64), null);
  assertEqual(findNearestSlot(slots, { x: 70, y: 30 }, 9), null);
});
