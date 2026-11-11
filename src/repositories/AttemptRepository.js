/**
 * @layer repositories
 * @phase P0
 * @doc §3.3 关键数据结构
 *
 * 尝试记录只追加，不修改。P0 的 id 由时间戳 + 进程内序号生成；
 * P2 接入 IndexedDB 后改用 store 级自增键或 UUID，接口不变。
 */

import { validateAttemptResult } from '../core/contracts.js';
import { BaseRepository } from './BaseRepository.js';

export class AttemptRepository extends BaseRepository {
  #sequence = 0;

  /** @param {import('../storage/StorageAdapter.js').StorageAdapter} adapter */
  constructor(adapter) {
    super(adapter, 'attempts');
  }

  /**
   * @param {import('../core/contracts.js').AttemptResult} result
   * @returns {Promise<Record<string, unknown>>}
   */
  async record(result) {
    validateAttemptResult(result);
    const id = `a.${result.timestamp}.${String(this.#sequence).padStart(4, '0')}`;
    this.#sequence += 1;
    return this.put({ ...result, id });
  }

  /**
   * @param {string} wordId
   * @returns {Promise<Record<string, unknown>[]>}
   */
  async listByWord(wordId) {
    const records = await this.query({ where: { wordId } });
    return records.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  }

  /**
   * @param {number} [limit]
   * @returns {Promise<Record<string, unknown>[]>}
   */
  async recent(limit = 20) {
    if (!Number.isInteger(limit) || limit < 0) throw new RangeError('limit must be >= 0');
    const records = await this.all();
    records.sort((a, b) => {
      const diff = Number(b.timestamp) - Number(a.timestamp);
      return diff !== 0 ? diff : String(a.id) < String(b.id) ? 1 : -1;
    });
    return records.slice(0, limit);
  }
}
