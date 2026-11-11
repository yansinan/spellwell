/**
 * @layer repositories
 * @phase P0
 * @doc §3.2 三层解耦架构
 *
 * 仓库层只依赖 StorageAdapter 的 7 个方法，禁止触碰具体存储 API。
 */

import { ContractError } from '../core/errors.js';
import { assertStorageAdapter } from '../storage/StorageAdapter.js';
import { isKnownStore } from '../storage/schema.js';

export class BaseRepository {
  /**
   * @param {import('../storage/StorageAdapter.js').StorageAdapter} adapter
   * @param {string} storeName
   */
  constructor(adapter, storeName) {
    this.adapter = assertStorageAdapter(adapter);
    if (!isKnownStore(storeName)) {
      throw new ContractError('REPOSITORY_STORE_UNKNOWN', `unknown store: ${storeName}`, { storeName });
    }
    this.storeName = storeName;
  }

  /**
   * @param {string} id
   * @returns {Promise<Record<string, unknown>|undefined>}
   */
  async get(id) {
    return this.adapter.get(this.storeName, id);
  }

  /**
   * @param {Record<string, unknown>} record
   * @returns {Promise<Record<string, unknown>>}
   */
  async put(record) {
    return this.adapter.put(this.storeName, record);
  }

  /**
   * @param {{ where?: Record<string, unknown>, limit?: number, offset?: number }} [options]
   * @returns {Promise<Record<string, unknown>[]>}
   */
  async query(options = {}) {
    return this.adapter.query(this.storeName, options);
  }

  /**
   * @returns {Promise<Record<string, unknown>[]>}
   */
  async all() {
    return this.query({});
  }
}
