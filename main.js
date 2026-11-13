/**
 * @layer app
 * @phase P9
 * @doc §5.1 目录结构
 *
 * 组合根：只负责装配与启动。
 * - `/`        → 练习设计页 → 学习端
 * - `/?dev=1`  → P0 骨架自检页
 * - `/?debug=1`→ 学习端 + 开发调试面板
 */

import { mountApp } from './src/ui/App.js';
import { createPracticeWorkspace } from './src/ui/bootstrap.js';
import { PracticeScreen } from './src/ui/PracticeScreen.js';
import { PracticeSetupScreen } from './src/ui/PracticeSetupScreen.js';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app root element');

const params = new URLSearchParams(window.location.search);
let showSetup = null;

async function boot() {
  if (params.get('dev') === '1') {
    document.documentElement.lang = 'zh-CN';
    document.title = 'SpellWell 拼写小屋 · P0';
    await mountApp(root);
    return;
  }

  document.documentElement.lang = 'en';
  const workspace = await createPracticeWorkspace();

  const mountPractice = ({ session, scheduler, loadReport, speedHistory, recordSpeed }) => {
    if (params.get('debug') === '1') {
      window.__SPELLWELL_DEBUG__ = {
        session,
        adapter: workspace.adapter,
        scheduler,
        storage: workspace.storage,
        contentSeeded: workspace.contentSeeded,
        units: workspace.units,
        settings: workspace.settings,
        loadReport,
      };
    }
    new PracticeScreen({
      root,
      session,
      debug: params.get('debug') === '1',
      onResult: (result) => scheduler.recordAttempt(result),
      loadReport,
      speedHistory,
      onSpeedRecord: recordSpeed,
      buildRepairSpec: (input) => scheduler.buildRepairSpec(input),
      onNewPractice: showSetup,
      onChangePractice: showSetup,
    }).mount();
  };

  showSetup = async () => {
    await workspace.refresh();
    new PracticeSetupScreen({
      root,
      workspace,
      onStart: ({ session, scheduler, loadReport, speedHistory, recordSpeed }) => mountPractice({ session, scheduler, loadReport, speedHistory, recordSpeed }),
    }).mount();
  };

  // 保留练习设计页；默认按记忆周期自动勾选单元，由孩子点 Start。
  await showSetup();
}

function showContentBanner() {
  if (document.getElementById('content-update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'content-update-banner';
  banner.className = 'sw-content-banner';
  banner.innerHTML = '<span>Content updated.</span><button type="button">New practice</button><button type="button" aria-label="Dismiss">×</button>';
  const buttons = banner.querySelectorAll('button');
  buttons[0].addEventListener('click', async () => {
    banner.remove();
    if (showSetup) await showSetup();
  });
  buttons[1].addEventListener('click', () => banner.remove());
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
      <header class="sw-practice__header"><span class="sw-brand">SpellWell</span></header>
      <main class="sw-practice__stage">
        <p class="sw-eyebrow">LOAD FAILED</p>
        <h1 class="sw-done__title">Could not start.</h1>
        <p class="sw-practice__hint">Run the local server and try again.</p>
        <p class="sw-practice__hint"><code>node tools/serve.mjs</code></p>
      </main>
    </div>
  `;
});
