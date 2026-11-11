/**
 * @layer repositories
 * @phase P0
 * @doc §2.3 内容后台
 *
 * 混淆项必须成对维护（sh-ch、ck-k），禁止单边记录。
 * 由于适配器 query 只做标量等值，数组/配对查询在这里的内存中完成。
 */

import { BaseRepository } from './BaseRepository.js';

export class ConfusableRepository extends BaseRepository {
  /** @param {import('../storage/StorageAdapter.js').StorageAdapter} adapter */
  constructor(adapter) {
    super(adapter, 'confusables');
  }

  /**
   * @param {string} graphemeId
   * @returns {Promise<Record<string, unknown>[]>}
   */
  async forGrapheme(graphemeId) {
    const all = await this.all();
    return all.filter((item) => item.a === graphemeId || item.b === graphemeId);
  }

  /**
   * @param {string} a
   * @param {string} b
   * @returns {Promise<Record<string, unknown>|undefined>}
   */
  async findBetween(a, b) {
    const all = await this.all();
    return all.find(
      (item) => (item.a === a && item.b === b) || (item.a === b && item.b === a),
    );
  }
}
