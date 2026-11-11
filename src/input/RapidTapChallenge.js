/**
 * @layer input
 * @phase P9
 * @doc §2.1 孩子端（学习模块）
 *
 * 可选的节奏连击挑战：默认关闭，结果不得写入 wordStates / graphemeStates / attempts，
 * 也不得进入错误画像。P9 才实现。
 */

import { NotImplementedError } from '../core/errors.js';

export class RapidTapChallenge {
  constructor() {
    this.enabled = false;
  }

  /** @param {unknown} [options] */
  start(options) {
    throw new NotImplementedError('P9', 'RapidTapChallenge.start');
  }

  /** 挑战会话结束，不产生持久化副作用。 */
  stop() {
    throw new NotImplementedError('P9', 'RapidTapChallenge.stop');
  }
}
