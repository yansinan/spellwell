/**
 * @layer sync
 * @phase P12
 * @doc §5.3 存储层平移策略
 *
 * 浏览器端快照同步管理器。只使用 StorageAdapter 的 exportAll/importAll；
 * 不参与调度和判定。连接失败时保持离线，不阻塞练习。
 */

import { createSyncClient, SyncHttpError } from './client.js';
import { mergeSnapshots } from './mergeSnapshots.js';
import { SYNC_BASE_URL } from './config.js';

export const SYNC_STORAGE_KEYS = Object.freeze({
  BASE_URL: 'spellwell.sync.baseUrl',
  TOKEN: 'spellwell.sync.deviceToken',
  PROJECT: 'spellwell.sync.projectId',
  DEVICE: 'spellwell.sync.deviceName',
});

const DEFAULT_BASE_URL = SYNC_BASE_URL;
const MAX_CONFLICT_RETRIES = 3;

function safeStorage(storage) {
  if (storage) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function withTimeout(fetchImpl, timeoutMs) {
  return async (url, options = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
}

export class SyncManager {
  /**
   * @param {{
   *   adapter: import('../storage/StorageAdapter.js').StorageAdapter,
   *   storage?: Storage|null,
   *   baseUrl?: string,
   *   fetchImpl?: typeof fetch,
   *   timeoutMs?: number,
   *   onChange?: ((status: {state: string, lastSyncAt: number|null, error: string|null}) => void)|null
   * }} input
   */
  constructor({ adapter, storage = null, baseUrl = null, fetchImpl = globalThis.fetch, timeoutMs = 8000, onChange = null }) {
    if (!adapter) throw new TypeError('SyncManager needs a StorageAdapter');
    this.adapter = adapter;
    this.storage = safeStorage(storage);
    this.baseUrl = baseUrl ?? this.storage?.getItem(SYNC_STORAGE_KEYS.BASE_URL) ?? DEFAULT_BASE_URL;
    this.fetchImpl = withTimeout(fetchImpl, timeoutMs);
    this.onChange = onChange;
    this.syncing = false;
    this.interval = null;
    this.retryTimer = null;
    this.status = { state: 'idle', lastSyncAt: null, error: null };
  }

  get configured() {
    return Boolean(this.storage?.getItem(SYNC_STORAGE_KEYS.TOKEN));
  }

  get deviceToken() {
    return this.storage?.getItem(SYNC_STORAGE_KEYS.TOKEN) ?? null;
  }

  #client() {
    return createSyncClient({
      baseUrl: this.baseUrl,
      deviceToken: this.deviceToken,
      fetchImpl: this.fetchImpl,
    });
  }

  #setStatus(state, error = null) {
    this.status = { ...this.status, state, error };
    if (state === 'synced') this.status.lastSyncAt = Date.now();
    try { this.onChange?.(this.status); } catch (err) { console.error('[SpellWell] sync status listener failed', err); }
  }

  /** @param {{bootstrapCode?: string, projectId?: string, pairingCode?: string, userName?: string, deviceName?: string}} input */
  async enroll(input) {
    const client = createSyncClient({ baseUrl: this.baseUrl, fetchImpl: this.fetchImpl });
    const result = await client.enroll(input);
    this.storage?.setItem(SYNC_STORAGE_KEYS.BASE_URL, this.baseUrl);
    this.storage?.setItem(SYNC_STORAGE_KEYS.TOKEN, result.deviceToken);
    this.storage?.setItem(SYNC_STORAGE_KEYS.PROJECT, result.projectId);
    this.storage?.setItem(SYNC_STORAGE_KEYS.DEVICE, result.device?.name ?? '');
    this.#setStatus('idle');
    return result;
  }

  /**
   * 拉取、合并、导入、推送。冲突时重新拉取，最多重试 3 次。
   * @returns {Promise<{state: string, revision: number|null}>}
   */
  async syncOnce() {
    if (!this.configured) {
      this.#setStatus('unconfigured');
      return { state: 'unconfigured', revision: null };
    }
    if (this.syncing) return { state: 'busy', revision: null };
    this.syncing = true;
    this.#setStatus('syncing');
    try {
      const client = this.#client();
      let lastError = null;
      for (let attempt = 0; attempt <= MAX_CONFLICT_RETRIES; attempt += 1) {
        try {
          const remote = await client.pull();
          const local = await this.adapter.exportAll();
          const merged = mergeSnapshots(local, remote?.snapshot ?? null);
          await this.adapter.importAll(merged);
          const pushed = await client.push({
            baseRevision: remote?.revision ?? 0,
            snapshot: merged,
          });
          this.#setStatus('synced');
          return { state: 'synced', revision: pushed.revision };
        } catch (error) {
          lastError = error;
          if (error instanceof SyncHttpError && error.status === 409 && attempt < MAX_CONFLICT_RETRIES) {
            continue;
          }
          throw error;
        }
      }
      throw lastError ?? new Error('sync failed');
    } catch (error) {
      // 连接失败/服务端不可用：保持本地可用，下一次定时或手动再试。
      this.#setStatus('offline', String(error?.message ?? error));
      return { state: 'offline', revision: null };
    } finally {
      this.syncing = false;
    }
  }

  /** 防抖请求一次同步；失败不抛出。 */
  requestSync(delayMs = 800) {
    if (!this.configured) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.syncOnce();
    }, Math.max(0, delayMs));
  }

  /** 启动定时同步；网络恢复时再触发一次。 */
  start({ intervalMs = 30000 } = {}) {
    this.stop();
    if (!this.configured) return;
    this.interval = setInterval(() => { void this.syncOnce(); }, Math.max(5000, intervalMs));
    if (typeof globalThis.addEventListener === 'function') {
      this.onlineHandler = () => { void this.syncOnce(); };
      globalThis.addEventListener('online', this.onlineHandler);
    }
    this.requestSync(0);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (this.onlineHandler && typeof globalThis.removeEventListener === 'function') {
      globalThis.removeEventListener('online', this.onlineHandler);
    }
    this.onlineHandler = null;
  }
}
