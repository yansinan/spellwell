/**
 * @layer sync
 * @phase P12
 * @doc §5.3 存储层平移策略
 *
 * 合并本地 IndexedDB 快照与远端快照。
 * 内容库按 contentRevision 取较新一侧；attempts 取并集；
 * wordStates/graphemeStates 取 updatedAt 较新记录；meta 做白名单合并。
 */

import { SCHEMA_VERSION, STORE_NAMES } from '../storage/schema.js';

const CONTENT_STORES = new Set(['words', 'graphemes', 'sentences', 'confusables']);
const STATE_STORES = new Map([
  ['wordStates', 'wordId'],
  ['graphemeStates', 'graphemeId'],
]);

function records(snapshot, store) {
  return Array.isArray(snapshot?.stores?.[store]) ? snapshot.stores[store] : [];
}

function metaValue(snapshot, key) {
  const item = records(snapshot, 'meta').find((record) => record.key === key);
  return item?.value;
}

function mergeByKey(local, remote, keyName, preferNewer = false) {
  const byKey = new Map();
  for (const record of [...remote, ...local]) {
    if (!record || typeof record !== 'object') continue;
    const key = String(record[keyName] ?? '');
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, record);
      continue;
    }
    if (preferNewer) {
      const oldTime = Date.parse(String(existing.updatedAt ?? '')) || 0;
      const newTime = Date.parse(String(record.updatedAt ?? '')) || 0;
      if (newTime > oldTime) byKey.set(key, record);
    }
  }
  return [...byKey.values()].sort((a, b) => String(a[keyName]).localeCompare(String(b[keyName])));
}

function mergeMeta(local, remote, contentSource) {
  const byKey = new Map();
  for (const record of [...records(contentSource, 'meta'), ...records(local, 'meta'), ...records(remote, 'meta')]) {
    if (!record || typeof record !== 'object' || typeof record.key !== 'string') continue;
    byKey.set(record.key, record);
  }
  const localRevision = Number(metaValue(local, 'contentRevision') ?? 0);
  const remoteRevision = Number(metaValue(remote, 'contentRevision') ?? 0);
  const chosenRevision = Math.max(localRevision, remoteRevision);
  if (chosenRevision > 0) byKey.set('contentRevision', { key: 'contentRevision', value: chosenRevision });
  const localVersion = Number(metaValue(local, 'contentVersion') ?? 0);
  const remoteVersion = Number(metaValue(remote, 'contentVersion') ?? 0);
  if (Math.max(localVersion, remoteVersion) > 0) {
    byKey.set('contentVersion', { key: 'contentVersion', value: Math.max(localVersion, remoteVersion) });
  }
  const speeds = new Map();
  for (const source of [local, remote]) {
    const record = records(source, 'meta').find((item) => item.key === 'speedHistory');
    for (const item of Array.isArray(record?.value?.items) ? record.value.items : []) {
      if (item && Number.isFinite(item.at)) speeds.set(item.at, item);
    }
  }
  if (speeds.size > 0) {
    byKey.set('speedHistory', {
      key: 'speedHistory',
      value: { version: 1, items: [...speeds.values()].sort((a, b) => a.at - b.at).slice(-50) },
    });
  }
  return [...byKey.values()];
}

/**
 * @param {Record<string, any>|null|undefined} local
 * @param {Record<string, any>|null|undefined} remote
 * @param {{preferRemote?: boolean}} [options] 首次绑定以远端已有用户数据为准
 * @returns {Record<string, any>}
 */
export function mergeSnapshots(local, remote, { preferRemote = false } = {}) {
  if (!local || local.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`local snapshot schemaVersion must be ${SCHEMA_VERSION}`);
  }
  if (remote && remote.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`remote snapshot schemaVersion must be ${SCHEMA_VERSION}`);
  }
  if (!remote) return local;
  if (preferRemote) {
    // 首次绑定：远端用户已有数据优先，避免新设备绑定前的本地练习污染原用户。
    const stores = {};
    for (const store of STORE_NAMES) stores[store] = records(remote, store);
    return { schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), stores };
  }
  const localRevision = Number(metaValue(local, 'contentRevision') ?? 0);
  const remoteRevision = Number(metaValue(remote, 'contentRevision') ?? 0);
  const contentSource = remoteRevision > localRevision ? remote : local;
  const stores = {};
  for (const store of STORE_NAMES) {
    if (CONTENT_STORES.has(store)) {
      stores[store] = records(contentSource, store);
    } else if (store === 'attempts') {
      stores[store] = mergeByKey(records(local, store), records(remote, store), 'id');
    } else if (STATE_STORES.has(store)) {
      stores[store] = mergeByKey(records(local, store), records(remote, store), STATE_STORES.get(store), true);
    } else if (store === 'meta') {
      stores[store] = mergeMeta(local, remote, contentSource);
    } else {
      stores[store] = records(local, store);
    }
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    stores,
  };
}

export { metaValue };
