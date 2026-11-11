/**
 * @layer ui
 * @phase P1
 * @doc §6.2 UI 风格参考：多邻国
 *
 * 拖拽几何：判断指针到槽位的距离，给“附近吸附”提供纯函数。
 */

/**
 * 点到矩形的最近距离；点在矩形内为 0。
 * @param {{x: number, y: number}} point
 * @param {{left: number, top: number, width: number, height: number}} rect
 * @returns {number}
 */
export function distanceToRect(point, rect) {
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  const dx = Math.max(rect.left - point.x, 0, point.x - right);
  const dy = Math.max(rect.top - point.y, 0, point.y - bottom);
  return Math.hypot(dx, dy);
}

/**
 * @typedef {{index: number, rect: {left: number, top: number, width: number, height: number}, element?: unknown}} SlotGeometry
 */

/**
 * 找吸附半径内最近的槽位；相对矩形边缘计算距离。
 * @param {SlotGeometry[]} slots
 * @param {{x: number, y: number}} point
 * @param {number} [maxDistance]
 * @returns {(SlotGeometry & {distance: number})|null}
 */
export function findNearestSlot(slots, point, maxDistance = 64) {
  let best = null;
  for (const slot of slots) {
    const distance = distanceToRect(point, slot.rect);
    if (distance <= maxDistance && (best === null || distance < best.distance)) {
      best = { ...slot, distance };
    }
  }
  return best;
}
