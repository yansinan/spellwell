/**
 * @layer input
 * @phase P10
 * @doc §3.2 三层解耦架构
 *
 * 指针/点选适配器：把 DOM 事件翻译成 InputEvent，不判定对错。
 * 提供 tap 等价路径；阈值内的 pointerup 视为点选，超过阈值视为拖放。
 */

function closestWithAttribute(node, attribute) {
  let current = node;
  while (current && typeof current.getAttribute === 'function') {
    if (current.getAttribute(attribute) !== null) return current;
    current = current.parentElement;
  }
  return null;
}

export class PointerAdapter {
  /**
   * @param {EventTarget|{addEventListener: Function, removeEventListener: Function}} target
   * @param {{dragThreshold?: number}} [options]
   */
  constructor(target, options = {}) {
    if (!target || typeof target.addEventListener !== 'function') {
      throw new TypeError('PointerAdapter needs an EventTarget');
    }
    this.target = target;
    this.dragThreshold = Number.isFinite(options.dragThreshold) ? options.dragThreshold : 8;
    this.detach = null;
  }

  /**
   * @param {(event: import('../core/contracts.js').InputEvent) => void} emit
   * @returns {() => void} detach
   */
  attach(emit) {
    if (typeof emit !== 'function') throw new TypeError('PointerAdapter needs an emit function');
    if (this.detach) return this.detach;
    let press = null;

    const onDown = (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      press = {
        id: event.pointerId ?? 'mouse',
        x: Number(event.clientX ?? 0),
        y: Number(event.clientY ?? 0),
        target: event.target,
      };
    };
    const onUp = (event) => {
      if (!press) return;
      if ((event.pointerId ?? 'mouse') !== press.id) return;
      const dx = Number(event.clientX ?? 0) - press.x;
      const dy = Number(event.clientY ?? 0) - press.y;
      const moved = Math.hypot(dx, dy) >= this.dragThreshold;
      const unit = closestWithAttribute(event.target ?? press.target, 'data-unit-id');
      const gap = closestWithAttribute(event.target ?? press.target, 'data-gap-index');
      const slot = closestWithAttribute(event.target ?? press.target, 'data-slot-index');
      press = null;
      if (moved && unit) {
        const unitId = unit.getAttribute('data-unit-id');
        if (!unitId) return;
        const slotIndex = slot?.getAttribute('data-slot-index');
        emit({
          kind: 'drag-unit',
          unitId,
          ...(slotIndex === null || slotIndex === undefined ? {} : { slotIndex: Number(slotIndex) }),
        });
        return;
      }
      if (unit) {
        const unitId = unit.getAttribute('data-unit-id');
        if (unitId) emit({ kind: 'tap-unit', unitId });
        return;
      }
      if (gap) {
        const gapIndex = Number(gap.getAttribute('data-gap-index'));
        if (Number.isInteger(gapIndex)) emit({ kind: 'tap-gap', gapIndex });
      }
    };
    const onCancel = () => { press = null; };

    this.target.addEventListener('pointerdown', onDown);
    this.target.addEventListener('pointerup', onUp);
    this.target.addEventListener('pointercancel', onCancel);
    this.detach = () => {
      this.target.removeEventListener('pointerdown', onDown);
      this.target.removeEventListener('pointerup', onUp);
      this.target.removeEventListener('pointercancel', onCancel);
      this.detach = null;
    };
    return this.detach;
  }
}
