/**
 * @layer storage
 * @phase P2
 * @doc §5.3 存储层平移策略
 *
 * P0 仅保留骨架。P2 实现时要求：
 * - 建库使用 schema.js 的 DB_VERSION / STORE_DEFS；
 * - 所有方法返回 Promise，错误统一包装；
 * - transaction 回调中的 get/put/query 必须绑定同一个 IDBTransaction；
 * - exportAll/importAll 必须与 MemoryAdapter 快照格式完全一致。
 */

import { NotImplementedError } from '../core/errors.js';
import { StorageAdapter } from './StorageAdapter.js';

export class IndexedDBAdapter extends StorageAdapter {
  /**
   * @param {{ name?: string, version?: number, factory?: IDBFactory }} [options]
   */
  constructor(options = {}) {
    super();
    this.name = options.name ?? 'spellwell';
    this.version = options.version ?? 1;
    this.factory = options.factory ?? globalThis.indexedDB;
    this.db = null;
  }

  async init() {
    throw new NotImplementedError('P2', 'IndexedDBAdapter.init');
  }

  async get() {
    throw new NotImplementedError('P2', 'IndexedDBAdapter.get');
  }

  async put() {
    throw new NotImplementedError('P2', 'IndexedDBAdapter.put');
  }

  async query() {
    throw new NotImplementedError('P2', 'IndexedDBAdapter.query');
  }

  async transaction() {
    throw new NotImplementedError('P2', 'IndexedDBAdapter.transaction');
  }

  async exportAll() {
    throw new NotImplementedError('P2', 'IndexedDBAdapter.exportAll');
  }

  async importAll() {
    throw new NotImplementedError('P2', 'IndexedDBAdapter.importAll');
  }
}
