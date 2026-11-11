/**
 * @layer storage
 * @phase P0
 * @doc §3.2 三层解耦架构
 *
 * 仓库层唯一可见的存储能力。新增方法必须先改 ADR 与 TRACEABILITY。
 */

import { ContractError } from '../core/errors.js';

export const STORAGE_METHODS = Object.freeze([
  'init',
  'get',
  'put',
  'query',
  'transaction',
  'exportAll',
  'importAll',
]);

/**
 * 抽象适配器。所有方法必须是 async，返回 Promise。
 * @abstract
 */
export class StorageAdapter {
  /**
   * 打开连接 / 建库。幂等。
   * @abstract
   * @returns {Promise<void>}
   */
  async init() {
    throw new Error('StorageAdapter.init() must be implemented');
  }

  /**
   * @abstract
   * @param {string} storeName
   * @param {string} key
   * @returns {Promise<Record<string, unknown>|undefined>}
   */
  async get(storeName, key) {
    throw new Error('StorageAdapter.get() must be implemented');
  }

  /**
   * @abstract
   * @param {string} storeName
   * @param {Record<string, unknown>} record
   * @returns {Promise<Record<string, unknown>>}
   */
  async put(storeName, record) {
    throw new Error('StorageAdapter.put() must be implemented');
  }

  /**
   * P0 语义：where 仅支持顶层字段严格相等；结果按主键字典序，过滤后应用 offset/limit。
   * @abstract
   * @param {string} storeName
   * @param {{ where?: Record<string, unknown>, limit?: number, offset?: number }} [options]
   * @returns {Promise<Record<string, unknown>[]>}
   */
  async query(storeName, options) {
    throw new Error('StorageAdapter.query() must be implemented');
  }

  /**
   * @abstract
   * @template T
   * @param {string[]} storeNames
   * @param {(adapter: StorageAdapter) => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async transaction(storeNames, fn) {
    throw new Error('StorageAdapter.transaction() must be implemented');
  }

  /**
   * @abstract
   * @returns {Promise<{schemaVersion: number, exportedAt: string, stores: Record<string, Record<string, unknown>[]>}>}
   */
  async exportAll() {
    throw new Error('StorageAdapter.exportAll() must be implemented');
  }

  /**
   * @abstract
   * @param {{schemaVersion: number, stores: Record<string, Record<string, unknown>[]>}} snapshot
   * @returns {Promise<{imported: number}>}
   */
  async importAll(snapshot) {
    throw new Error('StorageAdapter.importAll() must be implemented');
  }
}

/**
 * 结构检查；不检查业务语义。返回 adapter 便于链式使用。
 * @param {unknown} adapter
 * @returns {StorageAdapter}
 */
export function assertStorageAdapter(adapter) {
  if (typeof adapter !== 'object' || adapter === null) {
    throw new ContractError('STORAGE_ADAPTER_INVALID', 'adapter must be an object');
  }
  for (const method of STORAGE_METHODS) {
    if (typeof (/** @type {Record<string, unknown>} */ (adapter))[method] !== 'function') {
      throw new ContractError('STORAGE_ADAPTER_INVALID', `adapter is missing ${method}()`, { method });
    }
  }
  return /** @type {StorageAdapter} */ (adapter);
}
