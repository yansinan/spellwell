/**
 * @layer admin
 * @phase P12
 * @doc §2.3 内容后台
 *
 * 后台同步面板：未注册用 pairing code 注册；已注册显示身份、同步状态与配对码。
 */

import { createSyncClient } from '../sync/client.js';
import { SyncManager, SYNC_STORAGE_KEYS } from '../sync/SyncManager.js';
import { SYNC_BASE_URL, SYNC_PROJECT_ID } from '../sync/config.js';

function escape(value) {
  return String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function token() {
  try { return localStorage.getItem(SYNC_STORAGE_KEYS.TOKEN); } catch { return null; }
}

function baseUrl() {
  try { return localStorage.getItem(SYNC_STORAGE_KEYS.BASE_URL) || SYNC_BASE_URL; } catch { return SYNC_BASE_URL; }
}

function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function statusLabel(state) {
  return {
    idle: '待同步',
    syncing: '同步中',
    synced: '已同步',
    offline: '离线，等待重试',
    unconfigured: '未启用',
  }[state] ?? state;
}

export async function mountSyncAdmin(container, { adapter = null } = {}) {
  if (!container) return;
  const existing = token();

  if (!existing) {
    container.innerHTML = `
      <section class="sw-panel">
        <div class="sw-admin__batch-head">
          <div>
            <h2>同步配对</h2>
            <p class="sw-admin__muted">项目：<code>${escape(SYNC_PROJECT_ID)}</code>。未注册设备需要输入已注册设备生成的 Pairing Code。</p>
          </div>
        </div>
        <form class="sw-admin__field-row" data-sync-pair-form>
          <label>Pairing Code
            <input name="pairingCode" placeholder="ABCD-EFGH" autocomplete="off" required />
          </label>
          <label>设备名
            <input name="deviceName" value="后台浏览器" autocomplete="off" />
          </label>
          <button type="submit" class="sw-check">配对并启用同步</button>
        </form>
        <p class="sw-admin__muted" data-sync-message>设备 token 会保存在本机 localStorage；这是当前服务端协议的要求。</p>
      </section>
    `;
    container.querySelector('[data-sync-pair-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const message = container.querySelector('[data-sync-message]');
      const code = form.elements.pairingCode.value.trim();
      const deviceName = form.elements.deviceName.value.trim() || '后台浏览器';
      if (!code) return;
      message.textContent = '正在配对…';
      try {
        const client = createSyncClient({ baseUrl: baseUrl() });
        const result = await client.enroll({ pairingCode: code, deviceName });
        if (result.projectId !== SYNC_PROJECT_ID) {
          throw new Error(`配对返回了其他项目：${result.projectId}`);
        }
        localStorage.setItem(SYNC_STORAGE_KEYS.BASE_URL, baseUrl());
        localStorage.setItem(SYNC_STORAGE_KEYS.TOKEN, result.deviceToken);
        localStorage.setItem(SYNC_STORAGE_KEYS.PROJECT, result.projectId);
        localStorage.setItem(SYNC_STORAGE_KEYS.DEVICE, result.device?.name ?? deviceName);
        localStorage.setItem(SYNC_STORAGE_KEYS.FIRST_BIND, '1');
        await mountSyncAdmin(container, { adapter });
      } catch (error) {
        message.textContent = `配对失败：${error.message ?? error}`;
      }
    });
    return;
  }

  const client = createSyncClient({ baseUrl: baseUrl(), deviceToken: existing });
  const manager = adapter ? new SyncManager({ adapter }) : null;
  let identity;
  try {
    identity = await client.me();
  } catch (error) {
    container.innerHTML = `
      <section class="sw-panel">
        <h2>同步</h2>
        <p class="sw-admin__notice">本机 device token 无效或服务不可达：${escape(error.message ?? error)}</p>
        <button type="button" class="sw-text-button" data-sync-reset>清除本机 token</button>
      </section>
    `;
    container.querySelector('[data-sync-reset]')?.addEventListener('click', () => {
      localStorage.removeItem(SYNC_STORAGE_KEYS.TOKEN);
      localStorage.removeItem(SYNC_STORAGE_KEYS.FIRST_BIND);
      void mountSyncAdmin(container, { adapter });
    });
    return;
  }

  container.innerHTML = `
    <section class="sw-panel">
      <div class="sw-admin__batch-head">
        <div>
          <h2>同步</h2>
          <p class="sw-admin__muted">项目：<code>${escape(identity.projectId)}</code> · 用户：${escape(identity.user?.name ?? '—')} · 设备：${escape(identity.device?.name ?? '—')}</p>
        </div>
        <span class="sw-admin__badge is-ok">已注册</span>
      </div>
      <div class="sw-admin__toolbar">
        <button type="button" class="sw-text-button" data-sync-now>立即同步</button>
        <button type="button" class="sw-text-button" data-sync-pairing>获取配对码</button>
        <button type="button" class="sw-text-button" data-sync-reset>清除本机 token</button>
      </div>
      <p class="sw-admin__muted" data-sync-status>${manager ? '同步状态：待同步' : '本机 IndexedDB 不可用，仅能查看身份。'}</p>
      <pre class="sw-admin__muted" data-sync-pairing-output></pre>
    </section>
  `;
  const status = container.querySelector('[data-sync-status]');
  const pairingOutput = container.querySelector('[data-sync-pairing-output]');
  container.querySelector('[data-sync-now]')?.addEventListener('click', async () => {
    if (!manager) return;
    status.textContent = '同步中…';
    const result = await manager.syncOnce();
    status.textContent = `同步状态：${statusLabel(result.state)}${result.revision === null ? '' : ` · revision ${result.revision}`}`;
  });
  container.querySelector('[data-sync-pairing]')?.addEventListener('click', async () => {
    pairingOutput.textContent = '正在生成…';
    try {
      const pairing = await client.createPairingCode({ ttlSeconds: 600 });
      pairingOutput.textContent = `Pairing Code: ${pairing.code}\n有效期至: ${formatTime(pairing.expiresAt)}`;
    } catch (error) {
      pairingOutput.textContent = `生成失败：${error.message ?? error}`;
    }
  });
  container.querySelector('[data-sync-reset]')?.addEventListener('click', () => {
    localStorage.removeItem(SYNC_STORAGE_KEYS.TOKEN);
    localStorage.removeItem(SYNC_STORAGE_KEYS.FIRST_BIND);
    localStorage.removeItem(SYNC_STORAGE_KEYS.PROJECT);
    localStorage.removeItem(SYNC_STORAGE_KEYS.DEVICE);
    void mountSyncAdmin(container, { adapter });
  });
}
