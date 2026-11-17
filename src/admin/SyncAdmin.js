/**
 * @layer admin
 * @phase P12
 * @doc §2.3 内容后台
 *
 * 同步账户面板：未注册提供配对/创建新用户；已注册显示身份、同步状态、
 * 带期限的配对码，以及暂不可用的编辑资料说明。
 */

import { createSyncClient } from '../sync/client.js';
import { SyncManager, SYNC_STORAGE_KEYS } from '../sync/SyncManager.js';
import { SYNC_BASE_URL, SYNC_PROJECT_ID } from '../sync/config.js';

const PAIRING_TTL_SECONDS = 600;
const timers = new WeakMap();

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

function formatRemaining(expiresAt) {
  const remaining = Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000));
  return `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
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

function clearPanelTimer(container) {
  const timer = timers.get(container);
  if (timer) clearInterval(timer);
  timers.delete(container);
}

function storeRegistration(result, { firstBind }) {
  localStorage.setItem(SYNC_STORAGE_KEYS.BASE_URL, baseUrl());
  localStorage.setItem(SYNC_STORAGE_KEYS.TOKEN, result.deviceToken);
  localStorage.setItem(SYNC_STORAGE_KEYS.PROJECT, result.projectId);
  localStorage.setItem(SYNC_STORAGE_KEYS.DEVICE, result.device?.name ?? '');
  if (firstBind) localStorage.setItem(SYNC_STORAGE_KEYS.FIRST_BIND, '1');
  else localStorage.removeItem(SYNC_STORAGE_KEYS.FIRST_BIND);
}

function startPairingCountdown(container, pairing) {
  clearPanelTimer(container);
  const code = container.querySelector('[data-sync-code]');
  const remaining = container.querySelector('[data-sync-remaining]');
  const copy = container.querySelector('[data-sync-copy]');
  code.textContent = pairing.code;
  const update = () => {
    const left = formatRemaining(pairing.expiresAt);
    if (remaining) remaining.textContent = left === '00:00' ? '已过期，请重新生成' : `剩余 ${left}`;
    if (copy) copy.disabled = left === '00:00';
    if (left === '00:00') clearPanelTimer(container);
  };
  update();
  const timer = setInterval(update, 1000);
  timers.set(container, timer);
}

async function renderUnregistered(container, { adapter = null, deviceName = '浏览器' } = {}) {
  clearPanelTimer(container);
  container.innerHTML = `
    <section class="sw-panel">
      <div class="sw-admin__batch-head">
        <div>
          <h2>同步账户</h2>
          <p class="sw-admin__muted">固定项目：<code>${escape(SYNC_PROJECT_ID)}</code>。请选择加入已有用户，或创建独立的新用户。</p>
        </div>
      </div>
      <div class="sw-admin__field-row">
        <form data-sync-pair-form class="sw-panel sw-admin__sync-card">
          <h3>1. 配对已有用户</h3>
          <p class="sw-admin__muted">使用已注册设备生成的 Pairing Code，加入同一用户的数据。</p>
          <label>Pairing Code
            <input name="pairingCode" placeholder="ABCD-EFGH" autocomplete="off" required />
          </label>
          <label>设备名
            <input name="deviceName" value="${escape(deviceName)}" autocomplete="off" />
          </label>
          <button type="submit" class="sw-check">配对已有用户</button>
        </form>
        <form data-sync-create-form class="sw-panel sw-admin__sync-card">
          <h3>2. 创建新用户</h3>
          <p class="sw-admin__muted">在同一项目中创建独立用户；不会读取已有用户的学习数据。</p>
          <label>用户名
            <input name="userName" value="SpellWell" autocomplete="off" required />
          </label>
          <label>设备名
            <input name="deviceName" value="${escape(deviceName)}" autocomplete="off" />
          </label>
          <button type="submit" class="sw-text-button">创建新用户</button>
        </form>
      </div>
      <form data-sync-token-form class="sw-admin__toolbar">
        <label class="sw-admin__inline-field">已有 Device Token
          <input name="deviceToken" placeholder="dev_..." autocomplete="off" />
        </label>
        <button type="submit" class="sw-text-button">导入本机 Token</button>
      </form>
      <p class="sw-admin__muted" data-sync-pairing-disabled>3. 显示配对码：完成配对或创建用户后可用。</p>
      <p class="sw-admin__muted" data-sync-message></p>
    </section>
  `;
  const message = container.querySelector('[data-sync-message]');

  container.querySelector('[data-sync-pair-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const code = form.elements.pairingCode.value.trim();
    const name = form.elements.deviceName.value.trim() || deviceName;
    if (!code) return;
    message.textContent = '正在配对…';
    try {
      const client = createSyncClient({ baseUrl: baseUrl() });
      const result = await client.enroll({ pairingCode: code, deviceName: name });
      if (result.projectId !== SYNC_PROJECT_ID) throw new Error(`配对返回了其他项目：${result.projectId}`);
      storeRegistration(result, { firstBind: true });
      await mountSyncAdmin(container, { adapter, deviceName });
    } catch (error) {
      message.textContent = `配对失败：${error.message ?? error}`;
    }
  });

  container.querySelector('[data-sync-create-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const userName = form.elements.userName.value.trim();
    const name = form.elements.deviceName.value.trim() || deviceName;
    if (!userName) return;
    message.textContent = '正在创建用户…';
    try {
      const client = createSyncClient({ baseUrl: baseUrl() });
      const result = await client.enroll({ projectId: SYNC_PROJECT_ID, userName, deviceName: name });
      if (result.projectId !== SYNC_PROJECT_ID) throw new Error(`创建返回了其他项目：${result.projectId}`);
      storeRegistration(result, { firstBind: false });
      await mountSyncAdmin(container, { adapter, deviceName });
    } catch (error) {
      message.textContent = `创建失败：${error.message ?? error}`;
    }
  });

  container.querySelector('[data-sync-token-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = event.currentTarget.elements.deviceToken.value.trim();
    if (!value) return;
    localStorage.setItem(SYNC_STORAGE_KEYS.BASE_URL, baseUrl());
    localStorage.setItem(SYNC_STORAGE_KEYS.TOKEN, value);
    localStorage.removeItem(SYNC_STORAGE_KEYS.FIRST_BIND);
    await mountSyncAdmin(container, { adapter, deviceName });
  });
}

async function renderRegistered(container, { adapter = null, deviceName = '浏览器' } = {}) {
  const existing = token();
  const client = createSyncClient({ baseUrl: baseUrl(), deviceToken: existing });
  let identity;
  try {
    identity = await client.me();
  } catch (error) {
    container.innerHTML = `
      <section class="sw-panel">
        <h2>同步账户</h2>
        <p class="sw-admin__notice">本机 device token 无效或服务不可达：${escape(error.message ?? error)}</p>
        <button type="button" class="sw-text-button" data-sync-forget>清除本机 token</button>
      </section>
    `;
    container.querySelector('[data-sync-forget]')?.addEventListener('click', async () => {
      localStorage.removeItem(SYNC_STORAGE_KEYS.TOKEN);
      localStorage.removeItem(SYNC_STORAGE_KEYS.FIRST_BIND);
      await mountSyncAdmin(container, { adapter, deviceName });
    });
    return;
  }

  const manager = adapter ? new SyncManager({ adapter }) : null;
  container.innerHTML = `
    <section class="sw-panel">
      <div class="sw-admin__batch-head">
        <div>
          <h2>同步账户</h2>
          <p class="sw-admin__muted">项目：<code>${escape(identity.projectId)}</code> · 用户：${escape(identity.user?.name ?? '—')} · 设备：${escape(identity.device?.name ?? '—')}</p>
        </div>
        <span class="sw-admin__badge is-ok">已注册</span>
      </div>

      <div class="sw-admin__toolbar">
        <button type="button" class="sw-text-button" data-sync-now>立即同步</button>
        <button type="button" class="sw-text-button" disabled title="同步服务端尚未提供修改资料 API">编辑资料（暂不可用）</button>
        <button type="button" class="sw-text-button" data-sync-forget>清除本机 token</button>
      </div>
      <p class="sw-admin__muted">编辑资料暂不可用：当前同步服务端没有修改用户名/设备名的接口。</p>
      <p class="sw-admin__muted" data-sync-status>${manager ? '同步状态：待同步' : '本机 IndexedDB 不可用，仅能查看身份。'}</p>

      <div class="sw-admin__sync-card">
        <h3>3. 配对码</h3>
        <p class="sw-admin__muted">用于让新设备加入当前用户。每次生成有效期为 ${PAIRING_TTL_SECONDS / 60} 分钟，一次性使用。</p>
        <button type="button" class="sw-check" data-sync-pairing>生成配对码</button>
        <div class="sw-admin__toolbar" data-sync-code-box hidden>
          <code data-sync-code></code>
          <span class="sw-admin__muted" data-sync-remaining></span>
          <button type="button" class="sw-text-button" data-sync-copy>复制</button>
        </div>
        <p class="sw-admin__muted" data-sync-pairing-message></p>
      </div>
    </section>
  `;
  const status = container.querySelector('[data-sync-status]');
  const codeBox = container.querySelector('[data-sync-code-box]');
  const pairingMessage = container.querySelector('[data-sync-pairing-message]');

  container.querySelector('[data-sync-now]')?.addEventListener('click', async () => {
    if (!manager) return;
    status.textContent = '同步中…';
    const result = await manager.syncOnce();
    status.textContent = `同步状态：${statusLabel(result.state)}${result.revision === null ? '' : ` · revision ${result.revision}`}`;
  });

  container.querySelector('[data-sync-pairing]')?.addEventListener('click', async () => {
    pairingMessage.textContent = '正在生成…';
    try {
      const pairing = await client.createPairingCode({ ttlSeconds: PAIRING_TTL_SECONDS });
      codeBox.hidden = false;
      pairingMessage.textContent = `有效期至 ${formatTime(pairing.expiresAt)}，过期后请重新生成。`;
      startPairingCountdown(container, pairing);
    } catch (error) {
      pairingMessage.textContent = `生成失败：${error.message ?? error}`;
    }
  });

  container.querySelector('[data-sync-copy]')?.addEventListener('click', async () => {
    const code = container.querySelector('[data-sync-code]')?.textContent ?? '';
    try {
      await navigator.clipboard.writeText(code);
      pairingMessage.textContent = '配对码已复制。';
    } catch {
      pairingMessage.textContent = `请手动复制：${code}`;
    }
  });

  container.querySelector('[data-sync-forget]')?.addEventListener('click', async () => {
    localStorage.removeItem(SYNC_STORAGE_KEYS.TOKEN);
    localStorage.removeItem(SYNC_STORAGE_KEYS.FIRST_BIND);
    localStorage.removeItem(SYNC_STORAGE_KEYS.PROJECT);
    localStorage.removeItem(SYNC_STORAGE_KEYS.DEVICE);
    await mountSyncAdmin(container, { adapter, deviceName });
  });
}

export async function mountSyncAdmin(container, { adapter = null, deviceName = '后台浏览器' } = {}) {
  if (!container) return;
  clearPanelTimer(container);
  if (!token()) {
    await renderUnregistered(container, { adapter, deviceName });
    return;
  }
  await renderRegistered(container, { adapter, deviceName });
}
