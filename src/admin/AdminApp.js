/**
 * @layer admin
 * @phase P7
 * @doc §2.3 内容后台
 *
 * P7 才实现。后台只产内容、只校验；不得写 wordStates / graphemeStates / attempts。
 */

import { NotImplementedError } from '../core/errors.js';

export class AdminApp {
  constructor() {
    throw new NotImplementedError('P7', 'AdminApp');
  }
}
