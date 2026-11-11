/**
 * @layer input
 * @phase P8
 * @doc §3.2 三层解耦架构
 *
 * QWERTY 适配器：仅收集文本/退格/提交语义，不判定拼写。
 * 键盘解锁策略由调度层决定（连续正确后解锁），不在本文件实现。
 */

import { NotImplementedError } from '../core/errors.js';

export class KeyboardAdapter {
  /** @param {unknown} [target] */
  constructor(target) {
    this.target = target;
  }

  /**
   * @param {(event: import('../core/contracts.js').InputEvent) => void} emit
   * @returns {() => void} detach
   */
  attach(emit) {
    throw new NotImplementedError('P8', 'KeyboardAdapter.attach');
  }
}
