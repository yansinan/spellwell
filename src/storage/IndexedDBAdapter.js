/**
 * @layer storage
 * @phase P2
 * @doc §5.3 存储层平移策略
 *
 * IndexedDB 适配器。仓库层只通过 StorageAdapter 的 7 个方法访问它；
 * 查询在 P2 仍保持等值过滤 + limit/offset 语义。
 */

import { ContractError } from '../core/errors.js';
import { StorageAdapter } from './StorageAdapter.js';
import {
  DB_NAME,
  DB_VERSION,
  SCHEMA_VERSION,
  STORE_DEFS,
  STORE_NAMES,
  isKnownStore,
} from './schema.js';

/** @param {unknown} value */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {string} storeName
 * @returns {string}
 */
function keyPathOf(storeName) {
  return STORE_DEFS[storeName].keyPath;
}

export class IndexedDBAdapter extends StorageAdapter {
  /** @type {IDBDatabase|null} */
  #db = null;

  /** @type {Promise<void>|null} */
  #opening = null;

  /**
   * @param {{ name?: string, version?: number, factory?: IDBFactory }} [options]
   */
  constructor(options = {}) {
    super();
    this.name = options.name ?? DB_NAME;
    this.version = options.version ?? DB_VERSION;
    this.factory = options.factory ?? globalThis.indexedDB;
  }

  async init() {
    if (this.#db) return;
    if (this.#opening) return this.#opening;

    if (!this.factory || typeof this.factory.open !== 'function') {
      throw new ContractError('STORAGE_UNAVAILABLE', 'IndexedDB is not available in this environment');
    }

    this.#opening = new Promise((resolve, reject) => {
      let request;
      try {
        request = this.factory.open(this.name, this.version);
      } catch (error) {
        reject(new ContractError('STORAGE_OPEN_FAILED', 'IndexedDB open failed', {
          reason: String(error),
        }));
        return;
      }

      request.onupgradeneeded = () => {
        try {
          this.#upgrade(request.result, request.transaction);
        } catch (error) {
          try {
            request.transaction?.abort();
          } catch {
            // 忽略 abort 失败，原始 upgrade 错误更重要。
          }
          reject(new ContractError('STORAGE_UPGRADE_FAILED', 'IndexedDB schema upgrade failed', {
            reason: String(error),
          }));
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          this.#db = null;
        };
        this.#db = db;
        this.#opening = null;
        resolve();
      };

      request.onerror = () => {
        this.#opening = null;
        reject(new ContractError('STORAGE_OPEN_FAILED', 'IndexedDB open failed', {
          reason: request.error?.message ?? 'unknown',
        }));
      };
    });

    return this.#opening;
  }

  /**
   * @param {IDBDatabase} db
   * @param {IDBTransaction|null} tx
   */
  #upgrade(db, tx) {
    for (const [name, definition] of Object.entries(STORE_DEFS)) {
      const store = db.objectStoreNames.contains(name)
        ? tx?.objectStore(name)
        : db.createObjectStore(name, { keyPath: definition.keyPath });
      if (!store) throw new Error(`cannot create store ${name}`);
      for (const [indexName, keyPath] of Object.entries(definition.indexes ?? {})) {
        if (!store.indexNames.contains(indexName)) store.createIndex(indexName, keyPath);
      }
    }
  }

  /** @returns {IDBDatabase} */
  #requireDb() {
    if (!this.#db) {
      throw new ContractError('STORAGE_NOT_INITIALIZED', 'call init() before using the adapter');
    }
    return this.#db;
  }

  /**
   * @param {string} storeName
   * @returns {void}
   */
  #assertStore(storeName) {
    if (!isKnownStore(storeName)) {
      throw new ContractError('STORAGE_STORE_UNKNOWN', `unknown store: ${storeName}`, { store: storeName });
    }
  }

  /**
   * @param {IDBRequest} request
   * @returns {Promise<any>}
   */
  #request(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new ContractError('STORAGE_REQUEST_FAILED', 'IndexedDB request failed', {
        reason: request.error?.message ?? 'unknown',
      }));
    });
  }

  /**
   * @param {IDBTransaction} tx
   * @returns {Promise<void>}
   */
  #done(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new ContractError('STORAGE_TRANSACTION_FAILED', 'IndexedDB transaction failed', {
        reason: tx.error?.message ?? 'unknown',
      }));
      tx.onabort = () => reject(new ContractError('STORAGE_TRANSACTION_FAILED', 'IndexedDB transaction aborted', {
        reason: tx.error?.message ?? 'aborted',
      }));
    });
  }

  /**
   * @param {IDBTransaction} tx
   * @returns {{
   *   get: (store: string, key: IDBValidKey) => Promise<any>,
   *   put: (store: string, record: Record<string, unknown>) => Promise<Record<string, unknown>>,
   *   query: (store: string, options?: {where?: Record<string, unknown>, limit?: number, offset?: number}) => Promise<Record<string, unknown>[]>,
   *   clear: (store: string) => Promise<void>
   * }}
   */
  #scope(tx) {
    const request = (req) => this.#request(req);
    const storeOf = (name) => {
      this.#assertStore(name);
      return tx.objectStore(name);
    };

    return {
      get: (store, key) => request(storeOf(store).get(key)),
      async put(store, record) {
        if (!isPlainObject(record)) {
          throw new ContractError('STORAGE_RECORD_INVALID', 'record must be an object');
        }
        await request(storeOf(store).put(record));
        return record;
      },
      async query(store, options = {}) {
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

        const records = /** @type {Record<string, unknown>[]} */ (await request(storeOf(store).getAll()));
        const keyPath = keyPathOf(store);
        const filtered = Object.entries(where).length === 0
          ? records
          : records.filter((record) => Object.entries(where).every(([field, expected]) => record[field] === expected));

        filtered.sort((a, b) => {
          const left = String(a[keyPath] ?? '');
          const right = String(b[keyPath] ?? '');
          return left < right ? -1 : left > right ? 1 : 0;
        });

        const offset = options.offset ?? 0;
        const end = options.limit === undefined ? undefined : offset + options.limit;
        return filtered.slice(offset, end);
      },
      async clear(store) {
        await request(storeOf(store).clear());
      },
    };
  }

  /**
   * @template T
   * @param {string|string[]} storeNames
   * @param {IDBTransactionMode} mode
   * @param {(scope: ReturnType<IndexedDBAdapter['#scope']>) => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async #withTransaction(storeNames, mode, fn) {
    const db = this.#requireDb();
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    for (const name of names) this.#assertStore(name);

    let tx;
    try {
      tx = db.transaction(names, mode);
    } catch (error) {
      throw new ContractError('STORAGE_TRANSACTION_FAILED', 'cannot start IndexedDB transaction', {
        reason: String(error),
      });
    }

    const scope = this.#scope(tx);
    const done = this.#done(tx);

    try {
      const result = await fn(scope);
      await done;
      return result;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        // 可能已经 abort/complete。
      }
      await done.catch(() => {});
      throw error;
    }
  }

  async get(storeName, key) {
    return this.#withTransaction(storeName, 'readonly', (scope) => scope.get(storeName, key));
  }

  async put(storeName, record) {
    return this.#withTransaction(storeName, 'readwrite', (scope) => scope.put(storeName, record));
  }

  async query(storeName, options = {}) {
    return this.#withTransaction(storeName, 'readonly', (scope) => scope.query(storeName, options));
  }

  async transaction(storeNames, fn) {
    if (typeof fn !== 'function') {
      throw new ContractError('STORAGE_TRANSACTION_INVALID', 'transaction callback must be a function');
    }
    return this.#withTransaction(storeNames, 'readwrite', (scope) => fn(scope));
  }

  async exportAll() {
    return this.#withTransaction(STORE_NAMES, 'readonly', async (scope) => {
      /** @type {Record<string, Record<string, unknown>[]>} */
      const stores = {};
      for (const name of STORE_NAMES) {
        stores[name] = await scope.query(name);
      }
      return {
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        stores,
      };
    });
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

    const unknownStores = Object.keys(snapshot.stores).filter((name) => !isKnownStore(name));
    if (unknownStores.length > 0) {
      throw new ContractError('STORAGE_IMPORT_INVALID', `unknown stores: ${unknownStores.join(', ')}`);
    }

    /** @type {Map<string, Record<string, unknown>[]>} */
    const recordsByStore = new Map();
    let imported = 0;
    for (const name of STORE_NAMES) {
      const records = snapshot.stores[name] ?? [];
      if (!Array.isArray(records)) {
        throw new ContractError('STORAGE_IMPORT_INVALID', `stores.${name} must be an array`);
      }
      const keyPath = keyPathOf(name);
      for (const record of records) {
        if (!isPlainObject(record)) {
          throw new ContractError('STORAGE_IMPORT_INVALID', `stores.${name} contains a non-object record`);
        }
        const key = record[keyPath];
        if (typeof key !== 'string' && typeof key !== 'number') {
          throw new ContractError('STORAGE_IMPORT_INVALID', `stores.${name} record.${keyPath} is missing`);
        }
        imported += 1;
      }
      recordsByStore.set(name, records);
    }

    await this.#withTransaction(STORE_NAMES, 'readwrite', async (scope) => {
      for (const name of STORE_NAMES) {
        await scope.clear(name);
        for (const record of recordsByStore.get(name) ?? []) {
          await scope.put(name, record);
        }
      }
    });
    return { imported };
  }

  async close() {
    this.#db?.close();
    this.#db = null;
    this.#opening = null;
  }
}
