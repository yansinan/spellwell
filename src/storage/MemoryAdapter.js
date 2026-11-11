/**
 * @layer storage
 * @phase P0
 * @doc §5.3 存储层平移策略
 *
 * P0/P1 的内存适配器：与 IndexedDBAdapter 共享同一契约，用于 Node 测试与演示。
 * 数据在页面刷新后丢失，这是 P0 的预期行为（P2 接 IndexedDB）。
 */

import { ContractError } from '../core/errors.js';
import { assertStorageAdapter, StorageAdapter } from './StorageAdapter.js';
import { isKnownStore, SCHEMA_VERSION, STORE_DEFS, STORE_NAMES } from './schema.js';

const clone = typeof structuredClone === 'function'
  ? (value) => structuredClone(value)
  : (value) => JSON.parse(JSON.stringify(value));

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class MemoryAdapter extends StorageAdapter {
  /** @type {Map<string, Map<string, Record<string, unknown>>>} */
  #stores = new Map();

  /** @type {Record<string, Record<string, unknown>[]>|null} */
  #initialData;

  #initialized = false;
  #inTransaction = false;

  /**
   * @param {{ initialData?: Record<string, Record<string, unknown>[]> }} [options]
   */
  constructor(options = {}) {
    super();
    this.#initialData = options.initialData ?? null;
  }

  async init() {
    if (this.#initialized) return;
    for (const name of STORE_NAMES) {
      this.#stores.set(name, new Map());
    }
    this.#initialized = true;
    if (this.#initialData) {
      for (const [storeName, records] of Object.entries(this.#initialData)) {
        if (!isKnownStore(storeName)) {
          throw new ContractError('STORAGE_STORE_UNKNOWN', `unknown store in initialData: ${storeName}`);
        }
        for (const record of records) this.#write(storeName, record);
      }
    }
  }

  /**
   * @param {string} storeName
   * @returns {Map<string, Record<string, unknown>>}
   */
  #store(storeName) {
    this.#ensureReady();
    if (!isKnownStore(storeName)) {
      throw new ContractError('STORAGE_STORE_UNKNOWN', `unknown store: ${storeName}`, { store: storeName });
    }
    const store = this.#stores.get(storeName);
    if (!store) throw new Error(`store not initialized: ${storeName}`);
    return store;
  }

  #ensureReady() {
    if (!this.#initialized) {
      throw new ContractError('STORAGE_NOT_INITIALIZED', 'call init() before using the adapter');
    }
  }

  /**
   * @param {string} storeName
   * @param {Record<string, unknown>} record
   * @returns {Record<string, unknown>}
   */
  #write(storeName, record) {
    if (!isPlainObject(record)) {
      throw new ContractError('STORAGE_RECORD_INVALID', 'record must be an object');
    }
    const { keyPath } = STORE_DEFS[storeName];
    const key = record[keyPath];
    if (typeof key !== 'string' && typeof key !== 'number') {
      throw new ContractError('STORAGE_RECORD_INVALID', `record.${keyPath} must be a string or number`, {
        store: storeName,
        keyPath,
      });
    }
    this.#store(storeName).set(String(key), clone(record));
    return clone(record);
  }

  async get(storeName, key) {
    const record = this.#store(storeName).get(String(key));
    return record === undefined ? undefined : clone(record);
  }

  async put(storeName, record) {
    return this.#write(storeName, record);
  }

  async query(storeName, options = {}) {
    const where = options.where ?? {};
    if (!isPlainObject(where)) {
      throw new ContractError('STORAGE_QUERY_INVALID', 'where must be an object');
    }
    if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 0)) {
      throw new ContractError('STORAGE_QUERY_INVALID', 'limit must be a non-negative integer');
    }
    if (options.offset !== undefined && (!Number.isInteger(options.offset) || options.offset < 0)) {
      throw new ContractError('STORAGE_QUERY_INVALID', 'offset must be a non-negative integer');
    }

    const entries = [...this.#store(storeName).entries()];
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    let records = entries.map(([, record]) => record);
    const whereEntries = Object.entries(where);
    if (whereEntries.length > 0) {
      records = records.filter((record) =>
        whereEntries.every(([field, expected]) => record[field] === expected),
      );
    }

    const offset = options.offset ?? 0;
    const end = options.limit === undefined ? undefined : offset + options.limit;
    return records.slice(offset, end).map((record) => clone(record));
  }

  async transaction(storeNames, fn) {
    if (!Array.isArray(storeNames) || storeNames.length === 0) {
      throw new ContractError('STORAGE_TRANSACTION_INVALID', 'transaction needs at least one store');
    }
    if (typeof fn !== 'function') {
      throw new ContractError('STORAGE_TRANSACTION_INVALID', 'transaction callback must be a function');
    }
    if (this.#inTransaction) {
      throw new ContractError('STORAGE_TRANSACTION_NESTED', 'nested transactions are not supported');
    }
    for (const name of storeNames) this.#store(name);

    /** @type {Map<string, Map<string, Record<string, unknown>>>} */
    const snapshot = new Map();
    for (const name of storeNames) {
      const source = this.#store(name);
      snapshot.set(name, new Map([...source].map(([key, record]) => [key, clone(record)])));
    }

    this.#inTransaction = true;
    try {
      return await fn(this);
    } catch (error) {
      for (const [name, records] of snapshot) {
        this.#stores.set(name, records);
      }
      throw error;
    } finally {
      this.#inTransaction = false;
    }
  }

  async exportAll() {
    /** @type {Record<string, Record<string, unknown>[]>} */
    const stores = {};
    for (const name of STORE_NAMES) {
      const entries = [...this.#store(name).entries()];
      entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      stores[name] = entries.map(([, record]) => clone(record));
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      stores,
    };
  }

  async importAll(snapshot) {
    if (!isPlainObject(snapshot) || !isPlainObject(snapshot.stores)) {
      throw new ContractError('STORAGE_IMPORT_INVALID', 'snapshot must contain a stores object');
    }
    if (snapshot.schemaVersion !== SCHEMA_VERSION) {
      throw new ContractError(
        'STORAGE_IMPORT_SCHEMA_MISMATCH',
        `expected schemaVersion ${SCHEMA_VERSION}, got ${String(snapshot.schemaVersion)}`,
      );
    }

    /** @type {Map<string, Map<string, Record<string, unknown>>>} */
    const next = new Map();
    let imported = 0;
    for (const name of STORE_NAMES) {
      const records = snapshot.stores[name] ?? [];
      if (!Array.isArray(records)) {
        throw new ContractError('STORAGE_IMPORT_INVALID', `stores.${name} must be an array`);
      }
      const map = new Map();
      const { keyPath } = STORE_DEFS[name];
      for (const record of records) {
        if (!isPlainObject(record)) {
          throw new ContractError('STORAGE_IMPORT_INVALID', `stores.${name} contains a non-object record`);
        }
        const key = record[keyPath];
        if (typeof key !== 'string' && typeof key !== 'number') {
          throw new ContractError('STORAGE_IMPORT_INVALID', `stores.${name} record.${keyPath} is missing`);
        }
        map.set(String(key), clone(record));
        imported += 1;
      }
      next.set(name, map);
    }

    const unknownStores = Object.keys(snapshot.stores).filter((name) => !isKnownStore(name));
    if (unknownStores.length > 0) {
      throw new ContractError('STORAGE_IMPORT_INVALID', `unknown stores: ${unknownStores.join(', ')}`);
    }

    this.#ensureReady();
    for (const [name, map] of next) this.#stores.set(name, map);
    return { imported };
  }

  /** 测试辅助：清空所有集合，保持已初始化状态。 */
  async clear() {
    for (const name of STORE_NAMES) this.#store(name).clear();
  }
}

// 让“适配器必须实现 7 个方法”在模块加载时就成立。
assertStorageAdapter(new MemoryAdapter());
