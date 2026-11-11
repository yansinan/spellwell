/**
 * @layer tests
 * @phase P1
 * @doc §2.1 孩子端（学习模块）
 */

import { insertUnit, insertionIndexForPoint, previewInsertUnit } from '../../src/ui/sequenceOrder.js';
import { assertDeepEqual, assertEqual, test } from '../harness.js';

const cap = 3;

test('有序插入：候选块插入左/右半边，其他块相应右移', () => {
  assertDeepEqual(insertUnit(['f', 'i'], 'sh', 0, cap), ['sh', 'f', 'i']);
  assertDeepEqual(insertUnit(['f', 'i'], 'sh', 1, cap), ['f', 'sh', 'i']);
  assertDeepEqual(insertUnit(['f', 'i'], 'sh', 2, cap), ['f', 'i', 'sh']);
  assertDeepEqual(insertUnit(['f', 'i'], 'sh', 99, cap), ['f', 'i', 'sh']);
});

test('有序插入：已到位块向前/向后移动，落点按移除后的边界计算', () => {
  assertDeepEqual(insertUnit(['f', 'i', 'sh'], 'f', 3, cap), ['i', 'sh', 'f']);
  assertDeepEqual(insertUnit(['f', 'i', 'sh'], 'sh', 0, cap), ['sh', 'f', 'i']);
  assertDeepEqual(insertUnit(['f', 'i', 'sh'], 'f', 2, cap), ['i', 'f', 'sh']);
  assertDeepEqual(insertUnit(['f', 'i', 'sh'], 'i', 1, cap), ['f', 'i', 'sh']);
  assertDeepEqual(insertUnit(['f', 'i', 'sh'], 'i', 2, cap), ['f', 'i', 'sh']);
});

test('有序插入：满槽时新候选块被拒绝，已选块仍可移动', () => {
  assertEqual(insertUnit(['f', 'i', 'sh'], 'oo', 0, cap), null);
  assertDeepEqual(insertUnit(['f', 'i', 'sh'], 'sh', 0, cap), ['sh', 'f', 'i']);
});

test('落点左右判定：指针在目标中心左侧为前，右侧为后', () => {
  const rect = { left: 100, top: 0, width: 60, height: 60 };
  assertEqual(insertionIndexForPoint(2, rect, 110), 2);
  assertEqual(insertionIndexForPoint(2, rect, 129), 2);
  assertEqual(insertionIndexForPoint(2, rect, 130), 3);
  assertEqual(insertionIndexForPoint(2, rect, 170), 3);
});

test('实时预览：已到位块移动时返回侧滑映射与缺口', () => {
  const preview = previewInsertUnit(['f', 'i', 'sh'], 'f', 3, cap);
  assertEqual(preview.insertAt, 2);
  assertEqual(preview.sourceIndex, 0);
  assertDeepEqual(preview.moves, [
    { unitId: 'i', from: 1, to: 0 },
    { unitId: 'sh', from: 2, to: 1 },
  ]);
  assertDeepEqual(preview.order, ['i', 'sh', 'f']);
});

test('实时预览：向左插入时其他块整体右移一位', () => {
  const preview = previewInsertUnit(['f', 'i', 'sh'], 'sh', 0, cap);
  assertEqual(preview.insertAt, 0);
  assertEqual(preview.sourceIndex, 2);
  assertDeepEqual(preview.moves, [
    { unitId: 'f', from: 0, to: 1 },
    { unitId: 'i', from: 1, to: 2 },
  ]);
  assertDeepEqual(preview.order, ['sh', 'f', 'i']);
});

test('实时预览：候选块插入有空格时隐藏尾部空槽并显示缺口', () => {
  const preview = previewInsertUnit(['f', 'i'], 'sh', 0, cap);
  assertEqual(preview.insertAt, 0);
  assertEqual(preview.sourceIndex, -1);
  assertDeepEqual(preview.moves, [
    { unitId: 'f', from: 0, to: 1 },
    { unitId: 'i', from: 1, to: 2 },
  ]);
  assertDeepEqual(preview.order, ['sh', 'f', 'i']);
});

test('实时预览：满槽候选返回 null，已选块仍可预览移动', () => {
  assertEqual(previewInsertUnit(['f', 'i', 'sh'], 'oo', 0, cap), null);
  const preview = previewInsertUnit(['f', 'i', 'sh'], 'i', 0, cap);
  assertEqual(preview.insertAt, 0);
  assertDeepEqual(preview.order, ['i', 'f', 'sh']);
});
