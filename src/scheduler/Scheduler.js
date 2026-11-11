/**
 * @layer scheduler
 * @phase P3
 * @doc §2.1 孩子端（学习模块）
 *
 * P0 只冻结接口。P3 实现每日队列与错词调度：
 * - 5—8 个词：昨日错词 + 到期复习 + 新词；
 * - 错词次日强制再现，按错误画像选题型；
 * - 记录 attempt 后更新 wordState / graphemeState。
 * 调度层禁止渲染、判定、依赖 DOM。
 */

import { NotImplementedError } from '../core/errors.js';

export class Scheduler {
  /**
   * @param {{
   *   wordRepository: import('../repositories/WordRepository.js').WordRepository,
   *   stateRepository: import('../repositories/StateRepository.js').StateRepository,
   *   attemptRepository: import('../repositories/AttemptRepository.js').AttemptRepository,
   *   now?: () => Date
   * }} deps
   */
  constructor(deps) {
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
  }

  /**
   * @param {{date?: string, size?: number}} [options]
   * @returns {Promise<import('../core/contracts.js').QuestionSpec[]>}
   */
  async buildDailyQueue(options) {
    throw new NotImplementedError('P3', 'Scheduler.buildDailyQueue');
  }

  /**
   * @param {import('../core/contracts.js').AttemptResult} result
   * @returns {Promise<void>}
   */
  async recordAttempt(result) {
    throw new NotImplementedError('P3', 'Scheduler.recordAttempt');
  }
}
