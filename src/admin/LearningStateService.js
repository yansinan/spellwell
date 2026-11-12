/**
 * @layer admin
 * @phase P9
 * @doc §2.3 内容后台
 *
 * 受控学习状态维护：只允许后台把词/单元设置为
 * unstarted / reviewing / mastered，保留历史 attempts。
 */

import { MAX_INTERVAL_INDEX, PROBE_STREAK } from '../core/reviewConstants.js';
import { StateRepository, createWordState } from '../repositories/StateRepository.js';
import { toDayKey } from '../core/time.js';

export const ADMIN_LEARNING_STATUSES = Object.freeze(['unstarted', 'reviewing', 'mastered']);

/**
 * @param {string} status
 */
function assertStatus(status) {
  if (!ADMIN_LEARNING_STATUSES.includes(status)) {
    throw new RangeError(`unsupported admin learning status: ${String(status)}`);
  }
}

/**
 * @param {import('../core/contracts.js').WordState} state
 * @param {'unstarted'|'reviewing'|'mastered'} status
 * @param {Date} now
 * @returns {import('../core/contracts.js').WordState}
 */
export function placementState(state, status, now = new Date()) {
  assertStatus(status);
  const next = {
    ...state,
    status,
    source: 'admin-placement',
    updatedAt: now.toISOString(),
  };
  if (status === 'unstarted') {
    next.intervalIndex = 0;
    next.consecutiveCorrect = 0;
    next.lastResult = null;
    next.errorProfile = [];
    next.dueDate = null;
  } else if (status === 'reviewing') {
    next.intervalIndex = 2;
    next.consecutiveCorrect = Math.max(1, Number(state.consecutiveCorrect ?? 0));
    next.lastResult = 'correct';
    next.errorProfile = [];
    next.dueDate = toDayKey(now);
  } else {
    next.intervalIndex = MAX_INTERVAL_INDEX;
    next.consecutiveCorrect = PROBE_STREAK;
    next.lastResult = 'correct';
    next.errorProfile = [];
    next.dueDate = null;
  }
  return next;
}

/**
 * @param {{id: string}[]} words
 * @param {Map<string, import('../core/contracts.js').WordState>} states
 * @returns {'unstarted'|'reviewing'|'mastered'|'mixed'}
 */
export function deriveUnitStatus(words, states) {
  const values = words.map((word) => states.get(String(word.id))?.status ?? 'unstarted');
  if (values.every((value) => value === 'unstarted')) return 'unstarted';
  if (values.every((value) => value === 'mastered')) return 'mastered';
  if (values.every((value) => value === 'reviewing')) return 'reviewing';
  return 'mixed';
}

export class LearningStateService {
  /** @param {import('../storage/StorageAdapter.js').StorageAdapter} adapter */
  constructor(adapter) {
    this.adapter = adapter;
    this.repository = new StateRepository(adapter);
  }

  /** @returns {Promise<Map<string, import('../core/contracts.js').WordState>>} */
  async load() {
    const states = await this.repository.listWordStates();
    return new Map(states.map((state) => [String(state.wordId), state]));
  }

  /**
   * @param {string} wordId
   * @param {'unstarted'|'reviewing'|'mastered'} status
   * @param {Date} [now]
   */
  async setWordStatus(wordId, status, now = new Date()) {
    assertStatus(status);
    const existing = await this.repository.getWordState(wordId);
    const base = existing ?? createWordState(wordId, now);
    const next = placementState(base, status, now);
    await this.repository.saveWordState(next);
    return next;
  }

  /**
   * @param {{id: string}[]} words
   * @param {'unstarted'|'reviewing'|'mastered'} status
   * @param {Date} [now]
   */
  async setUnitStatus(words, status, now = new Date()) {
    assertStatus(status);
    const results = [];
    for (const word of words) {
      results.push(await this.setWordStatus(String(word.id), status, now));
    }
    return results;
  }
}
