/**
 * @layer ui
 * @phase P1
 * @doc §2.1 孩子端（学习模块）
 *
 * 有序选择的重排纯逻辑：拖到目标槽位左半边插到前面，右半边插到后面。
 * 不碰 DOM，便于覆盖“向前/向后移动、落点跨越自身、满槽拒绝”等边界。
 */

/**
 * @param {number} slotIndex 目标槽位下标
 * @param {{left: number, width: number}} rect
 * @param {number} x 指针横坐标
 * @returns {number} 插入边界，0..slotCount
 */
export function insertionIndexForPoint(slotIndex, rect, x) {
  return slotIndex + (x >= rect.left + rect.width / 2 ? 1 : 0);
}

/**
 * 把一个单位插入有序列表；如果单位已存在，先移出再插入。
 * 返回新数组；候选单位在满槽时返回 null（调用方弹回）。
 * @param {string[]} unitIds
 * @param {string} unitId
 * @param {number} boundary 0..unitIds.length
 * @param {number} capacity
 * @returns {string[]|null}
 */
export function insertUnit(unitIds, unitId, boundary, capacity) {
  const ordered = [...unitIds];
  const sourceIndex = ordered.indexOf(unitId);
  let insertAt = Number.isInteger(boundary) ? boundary : ordered.length;

  if (sourceIndex >= 0) {
    ordered.splice(sourceIndex, 1);
    if (insertAt > sourceIndex) insertAt -= 1;
  } else if (ordered.length >= capacity) {
    return null;
  }

  insertAt = Math.max(0, Math.min(insertAt, ordered.length));
  ordered.splice(insertAt, 0, unitId);
  return ordered;
}

/**
 * 拖拽中的实时预览：返回当前槽位 → 预览槽位的移动映射，以及插入缺口位置。
 * 不修改状态；候选满槽返回 null。
 * @param {string[]} unitIds
 * @param {string} unitId
 * @param {number} boundary
 * @param {number} capacity
 * @returns {{insertAt: number, sourceIndex: number, moves: {unitId: string, from: number, to: number}[], order: string[]}|null}
 */
export function previewInsertUnit(unitIds, unitId, boundary, capacity) {
  const current = [...unitIds];
  const sourceIndex = current.indexOf(unitId);
  let insertAt = Number.isInteger(boundary) ? boundary : current.length;

  if (sourceIndex >= 0) {
    if (insertAt > sourceIndex) insertAt -= 1;
  } else if (current.length >= capacity) {
    return null;
  }

  const remaining = sourceIndex >= 0
    ? current.filter((_, index) => index !== sourceIndex)
    : current;
  insertAt = Math.max(0, Math.min(insertAt, remaining.length));

  const moves = [];
  current.forEach((id, index) => {
    if (index === sourceIndex) return;
    const base = sourceIndex >= 0 && index > sourceIndex ? index - 1 : index;
    const to = base >= insertAt ? base + 1 : base;
    moves.push({ unitId: id, from: index, to });
  });

  const order = [...remaining];
  order.splice(insertAt, 0, unitId);
  return { insertAt, sourceIndex, moves, order };
}
