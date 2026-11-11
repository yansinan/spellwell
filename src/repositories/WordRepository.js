/**
 * @layer repositories
 * @phase P0
 * @doc §2.3 内容后台
 *
 * 词条查询。内容本身只读；学习状态在 StateRepository。
 */

import { BaseRepository } from './BaseRepository.js';

export class WordRepository extends BaseRepository {
  /** @param {import('../storage/StorageAdapter.js').StorageAdapter} adapter */
  constructor(adapter) {
    super(adapter, 'words');
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
   * @param {1|2} level
   * @returns {Promise<Record<string, unknown>[]>}
   */
  async listByLevel(level) {
    if (level !== 1 && level !== 2) throw new RangeError('level must be 1 or 2');
    return this.query({ where: { level } });
  }
}
