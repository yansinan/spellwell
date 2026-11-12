/**
 * @layer storage
 * @phase P2
 * @doc §5.3 存储层平移策略
 *
 * 内容导入：只写内容库 + meta，不碰学习状态。
 * 同一 contentVersion 幂等跳过；P9 的 v2→v3 走迁移保留后台编辑，其他版本覆盖写入。
 */

import { ContractError } from '../core/errors.js';

export const CONTENT_VERSION = 11;

const CONTENT_STORES = Object.freeze(['words', 'graphemes', 'sentences', 'confusables']);

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {{
 *   words: {items: Record<string, unknown>[]},
 *   graphemes: {items: Record<string, unknown>[]},
 *   sentences: {items: Record<string, unknown>[]},
 *   confusables: {items: Record<string, unknown>[]}
 * }} content
 */
function validateContent(content) {
  for (const name of CONTENT_STORES) {
    const doc = content[name];
    if (!isPlainObject(doc) || !Array.isArray(doc.items)) {
      throw new ContractError('CONTENT_IMPORT_INVALID', `content.${name}.items must be an array`);
    }
    for (const item of doc.items) {
      if (!isPlainObject(item) || typeof item.id !== 'string' || item.id.length === 0) {
        throw new ContractError('CONTENT_IMPORT_INVALID', `content.${name} item needs an id`);
      }
    }
  }
}

/**
 * @param {import('./StorageAdapter.js').StorageAdapter} adapter
 * @returns {Promise<number|null>}
 */
export async function readContentVersion(adapter) {
  const record = await adapter.get('meta', 'contentVersion');
  return record && typeof record.value === 'number' ? record.value : null;
}

/**
 * @param {import('./StorageAdapter.js').StorageAdapter} adapter
 * @param {{
 *   words: {items: Record<string, unknown>[]},
 *   graphemes: {items: Record<string, unknown>[]},
 *   sentences: {items: Record<string, unknown>[]},
 *   confusables: {items: Record<string, unknown>[]},
 *   version?: number
 * }} content
 * @returns {Promise<{seeded: boolean, version: number, counts: Record<string, number>}>}
 */
export async function importContent(adapter, content) {
  validateContent(content);
  const version = content.version ?? CONTENT_VERSION;
  if (!Number.isInteger(version) || version < 1) {
    throw new ContractError('CONTENT_IMPORT_INVALID', 'content.version must be a positive integer');
  }

  const current = await readContentVersion(adapter);
  if (current === version) {
    return {
      seeded: false,
      version,
      counts: Object.fromEntries(CONTENT_STORES.map((name) => [name, content[name].items.length])),
    };
  }

  const counts = Object.fromEntries(CONTENT_STORES.map((name) => [name, content[name].items.length]));
  await adapter.transaction([...CONTENT_STORES, 'meta'], async (tx) => {
    for (const name of CONTENT_STORES) {
      for (const item of content[name].items) {
        await tx.put(name, item);
      }
    }
    await tx.put('meta', { key: 'contentVersion', value: version });
  });

  return { seeded: true, version, counts };
}

/**
 * P9：contentVersion 2 → 3，补齐 grade/term/unit，不覆盖后台已编辑的词。
 * @param {import('./StorageAdapter.js').StorageAdapter} adapter
 */
export async function migrateContentV2ToV3(adapter) {
  const current = await readContentVersion(adapter);
  if (current !== 2) return { migrated: false, version: current };
  const words = await adapter.query('words', {});
  const legacy = {
    'u1-1': { grade: 1, term: '下', unit: 1 },
    'u1-2': { grade: 1, term: '下', unit: 2 },
    'u2-1': { grade: 2, term: '上', unit: 1 },
  };
  await adapter.transaction(['words', 'meta'], async (tx) => {
    for (const word of words) {
      const scope = legacy[word.unitId] ?? (Number(word.level) === 2
        ? { grade: 2, term: '上', unit: 1 }
        : { grade: 1, term: '下', unit: 1 });
      const unitId = `g${scope.grade}-s${scope.term === '下' ? '2' : '1'}-u${scope.unit}`;
      const unitLabel = `${scope.grade === 1 ? '一' : '二'}年级${scope.term} · 第${scope.unit}单元`;
      await tx.put('words', { ...word, ...scope, unitId, unitLabel });
    }
    await tx.put('meta', { key: 'contentVersion', value: 3 });
  });
  return { migrated: true, version: 3 };
}
