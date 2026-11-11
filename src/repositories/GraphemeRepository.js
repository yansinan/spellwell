/**
 * @layer repositories
 * @phase P0
 * @doc §2.3 内容后台
 *
 * 字母组合查询。组合的分层与家族关系由人工维护。
 */

import { BaseRepository } from './BaseRepository.js';

export class GraphemeRepository extends BaseRepository {
  /** @param {import('../storage/StorageAdapter.js').StorageAdapter} adapter */
  constructor(adapter) {
    super(adapter, 'graphemes');
  }

  /**
   * @param {string} text
   * @returns {Promise<Record<string, unknown>|undefined>}
   */
  async findByText(text) {
    const normalized = text.trim().toLowerCase();
    if (normalized.length === 0) return undefined;
    const [match] = await this.query({ where: { text: normalized }, limit: 1 });
    return match;
  }

  /**
   * @param {'T1'|'T2'|'T3'|'T4'} tier
   * @returns {Promise<Record<string, unknown>[]>}
   */
  async listByTier(tier) {
    if (!['T1', 'T2', 'T3', 'T4'].includes(tier)) {
      throw new RangeError(`invalid tier: ${tier}`);
    }
    return this.query({ where: { tier } });
  }
}
