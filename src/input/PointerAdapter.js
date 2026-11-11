/**
 * @layer input
 * @phase P8
 * @doc §3.2 三层解耦架构
 *
 * 指针/点选适配器：把 DOM 事件翻译成 InputEvent，不判定对错。
 * 必须同时提供 tap 路径（移动端没有 hover/拖拽）。
 */

import { NotImplementedError } from '../core/errors.js';

export class PointerAdapter {
  /** @param {unknown} [target] */
  constructor(target) {
    this.target = target;
  }

  /**
   * @param {(event: import('../core/contracts.js').InputEvent) => void} emit
   * @returns {() => void} detach
   */
  attach(emit) {
    throw new NotImplementedError('P8', 'PointerAdapter.attach');
  }
}
