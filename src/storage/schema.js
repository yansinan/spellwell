/**
 * @layer storage
 * @phase P0
 * @doc §5.3 存储层平移策略
 *
 * 存储集合的唯一真相。IndexedDB 的 objectStore / 未来 SQL 的表都由这里派生。
 */

export const DB_NAME = 'spellwell';
export const DB_VERSION = 1;
export const SCHEMA_VERSION = 1;

/**
 * @typedef {Object} StoreDefinition
 * @property {string} keyPath
 * @property {Record<string, string>} [indexes] 索引名 → 字段路径
 */

/** @type {Record<string, StoreDefinition>} */
export const STORE_DEFS = Object.freeze({
  words: Object.freeze({ keyPath: 'id' }),
  graphemes: Object.freeze({ keyPath: 'id' }),
  sentences: Object.freeze({ keyPath: 'id' }),
  confusables: Object.freeze({ keyPath: 'id' }),
  wordStates: Object.freeze({ keyPath: 'wordId', indexes: Object.freeze({ dueDate: 'dueDate' }) }),
  graphemeStates: Object.freeze({ keyPath: 'graphemeId', indexes: Object.freeze({ dueDate: 'dueDate' }) }),
  attempts: Object.freeze({
    keyPath: 'id',
    indexes: Object.freeze({ wordId: 'wordId', timestamp: 'timestamp' }),
  }),
  meta: Object.freeze({ keyPath: 'key' }),
});

export const STORE_NAMES = Object.freeze(Object.keys(STORE_DEFS));

export const CONTENT_STORES = Object.freeze(['words', 'graphemes', 'sentences', 'confusables']);
export const LEARNING_STORES = Object.freeze(['wordStates', 'graphemeStates', 'attempts']);

export const META_KEYS = Object.freeze({
  CONTENT_VERSION: 'contentVersion',
  LAST_EXPORT_AT: 'lastExportAt',
  SCHEMA_VERSION: 'schemaVersion',
});

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isKnownStore(name) {
  return Object.prototype.hasOwnProperty.call(STORE_DEFS, name);
}

/**
 * @param {string} name
 * @returns {StoreDefinition}
 */
export function getStoreDefinition(name) {
  if (!isKnownStore(name)) {
    throw new RangeError(`unknown store: ${name}`);
  }
  return STORE_DEFS[name];
}
