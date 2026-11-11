/**
 * @layer repositories
 * @phase P0
 * @doc §3.3 关键数据结构
 *
 * 学习状态的读写。状态变更的“算法”在 scheduler；这里只负责默认值与持久化。
 */

import { validateGraphemeState, validateWordState } from '../core/contracts.js';
import { toDayKey, todayKey } from '../core/time.js';
import { BaseRepository } from './BaseRepository.js';

/**
 * 与 locale 无关的稳定字符串比较，保证测试与导出可复现。
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function compareStrings(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * @param {string} wordId
 * @param {Date} [now]
 * @returns {import('../core/contracts.js').WordState}
 */
export function createWordState(wordId, now = new Date()) {
  const state = {
    wordId,
    intervalIndex: 0,
    consecutiveCorrect: 0,
    lastResult: null,
    errorProfile: [],
    status: 'learning',
    dueDate: toDayKey(now),
    updatedAt: now.toISOString(),
  };
  validateWordState(state);
  return /** @type {import('../core/contracts.js').WordState} */ (state);
}

/**
 * @param {string} graphemeId
 * @param {Date} [now]
 * @returns {import('../core/contracts.js').GraphemeState}
 */
export function createGraphemeState(graphemeId, now = new Date()) {
  const state = {
    graphemeId,
    intervalIndex: 0,
    consecutiveCorrect: 0,
    wordsPassed: [],
    status: 'learning',
    dueDate: toDayKey(now),
    lastResult: null,
    updatedAt: now.toISOString(),
  };
  validateGraphemeState(state);
  return /** @type {import('../core/contracts.js').GraphemeState} */ (state);
}

export class StateRepository extends BaseRepository {
  /** @param {import('../storage/StorageAdapter.js').StorageAdapter} adapter */
  constructor(adapter) {
    super(adapter, 'wordStates');
  }

  /**
   * @param {string} wordId
   * @returns {Promise<import('../core/contracts.js').WordState>}
   */
  async getWordState(wordId) {
    const existing = await this.get(wordId);
    if (!existing) return createWordState(wordId);
    validateWordState(existing);
    return /** @type {import('../core/contracts.js').WordState} */ (existing);
  }

  /**
   * @param {import('../core/contracts.js').WordState} state
   * @returns {Promise<import('../core/contracts.js').WordState>}
   */
  async saveWordState(state) {
    validateWordState(state);
    await this.put(/** @type {Record<string, unknown>} */ (state));
    return state;
  }

  /**
   * 到期且未掌握的词；按 dueDate、wordId 排序，保证可复现。
   * @param {string} [today]
   * @returns {Promise<import('../core/contracts.js').WordState[]>}
   */
  async listDueWords(today = todayKey()) {
    const all = await this.adapter.query('wordStates', {});
    return all
      .filter((state) => state.status !== 'mastered')
      .filter((state) => typeof state.dueDate === 'string' && state.dueDate <= today)
      .sort((a, b) => {
        const dateCompare = compareStrings(String(a.dueDate), String(b.dueDate));
        return dateCompare !== 0 ? dateCompare : compareStrings(String(a.wordId), String(b.wordId));
      })
      .map((state) => /** @type {import('../core/contracts.js').WordState} */ (state));
  }

  /**
   * @param {'learning'|'reviewing'|'probe'|'mastered'} status
   * @returns {Promise<import('../core/contracts.js').WordState[]>}
   */
  async listWordsByStatus(status) {
    const records = await this.adapter.query('wordStates', { where: { status } });
    return /** @type {import('../core/contracts.js').WordState[]} */ (records);
  }

  /**
   * @param {string} graphemeId
   * @returns {Promise<import('../core/contracts.js').GraphemeState>}
   */
  async getGraphemeState(graphemeId) {
    const existing = await this.adapter.get('graphemeStates', graphemeId);
    if (!existing) return createGraphemeState(graphemeId);
    validateGraphemeState(existing);
    return /** @type {import('../core/contracts.js').GraphemeState} */ (existing);
  }

  /**
   * @param {import('../core/contracts.js').GraphemeState} state
   * @returns {Promise<import('../core/contracts.js').GraphemeState>}
   */
  async saveGraphemeState(state) {
    validateGraphemeState(state);
    await this.adapter.put('graphemeStates', /** @type {Record<string, unknown>} */ (state));
    return state;
  }

  /**
   * @param {string} [today]
   * @returns {Promise<import('../core/contracts.js').GraphemeState[]>}
   */
  async listDueGraphemes(today = todayKey()) {
    const all = await this.adapter.query('graphemeStates', {});
    return all
      .filter((state) => state.status !== 'steady')
      .filter((state) => typeof state.dueDate === 'string' && state.dueDate <= today)
      .sort((a, b) => {
        const dateCompare = compareStrings(String(a.dueDate), String(b.dueDate));
        return dateCompare !== 0 ? dateCompare : compareStrings(String(a.graphemeId), String(b.graphemeId));
      })
      .map((state) => /** @type {import('../core/contracts.js').GraphemeState} */ (state));
  }
}
