/**
 * @layer app
 * @phase P1
 * @doc §5.1 目录结构
 *
 * 组合根：只负责装配与启动，不含业务规则。
 * - `/`        → P1 学习端
 * - `/?dev=1`  → P0 骨架自检页
 * - `/?debug=1`→ 学习端 + 开发调试面板
 */

import { mountApp } from './src/ui/App.js';
import { createP1Session } from './src/ui/bootstrap.js';
import { PracticeScreen } from './src/ui/PracticeScreen.js';

const root = document.getElementById('app');

if (!root) {
  throw new Error('Missing #app root element');
}

const params = new URLSearchParams(window.location.search);

async function boot() {
  if (params.get('dev') === '1') {
    document.documentElement.lang = 'zh-CN';
    document.title = 'SpellWell 拼写小屋 · P0';
    await mountApp(root);
    return;
  }

  document.documentElement.lang = 'en';
  const { session, adapter, scheduler, storage, contentSeeded, loadReport } = await createP1Session();
  if (params.get('debug') === '1') {
    window.__SPELLWELL_DEBUG__ = { session, adapter, scheduler, storage, contentSeeded, loadReport };
  }
  new PracticeScreen({
    root,
    session,
    debug: params.get('debug') === '1',
    onResult: (result) => scheduler.recordAttempt(result),
    loadReport,
  }).mount();
}

function showContentBanner() {
  if (document.getElementById('content-update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'content-update-banner';
  banner.className = 'sw-content-banner';
  banner.innerHTML = '<span>Content updated.</span><button type="button">Reload</button>';
  banner.querySelector('button').addEventListener('click', () => window.location.reload());
  document.body.append(banner);
}

if (typeof BroadcastChannel === 'function') {
  const channel = new BroadcastChannel('spellwell-content');
  channel.addEventListener('message', (event) => {
    if (event.data?.type === 'content-updated') showContentBanner();
  });
}

boot().catch((error) => {
  console.error('[SpellWell] boot failed', error);
  root.innerHTML = `
    <div class="sw-practice">
      <header class="sw-practice__header">
        <span class="sw-brand">SpellWell</span>
      </header>
      <main class="sw-practice__stage">
        <p class="sw-eyebrow">LOAD FAILED</p>
        <h1 class="sw-done__title">Could not start.</h1>
        <p class="sw-practice__hint">Run the local server and try again.</p>
        <p class="sw-practice__hint"><code>node tools/serve.mjs</code></p>
      </main>
    </div>
  `;
});
