/**
 * @layer repositories
 * @phase P0
 * @doc §2.3 内容后台
 *
 * 语境句查询。句子的语义唯一性由人工评审，不由运行时判断。
 */

import { BaseRepository } from './BaseRepository.js';

export class SentenceRepository extends BaseRepository {
  /** @param {import('../storage/StorageAdapter.js').StorageAdapter} adapter */
  constructor(adapter) {
    super(adapter, 'sentences');
  }

  /**
   * @param {string} wordId
   * @returns {Promise<Record<string, unknown>[]>}
   */
  async forWord(wordId) {
    return this.query({ where: { wordId } });
  }
}
