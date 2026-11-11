/**
 * @layer core
 * @phase P0
 * @doc §3.2 三层解耦架构
 */

/**
 * 契约/边界错误。用于跨层数据结构不合法时快速失败。
 */
export class ContractError extends Error {
  /**
   * @param {string} code 稳定错误码，测试与日志依赖它
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ContractError';
    this.code = code;
    this.details = details;
  }
}

/**
 * 未到实现阶段的功能。禁止用空值/空数组伪装成功。
 */
export class NotImplementedError extends Error {
  /**
   * @param {string} phase 例如 'P3'
   * @param {string} feature 例如 'Scheduler.buildDailyQueue'
   */
  constructor(phase, feature) {
    super(`${feature} is not implemented until ${phase}`);
    this.name = 'NotImplementedError';
    this.code = 'PHASE_NOT_IMPLEMENTED';
    this.phase = phase;
    this.feature = feature;
  }
}
