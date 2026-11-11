/**
 * @layer ui
 * @phase P0
 * @doc §6.2 UI 风格参考：多邻国
 *
 * P0 开发状态页：只展示骨架自检与视觉 token 样片，不包含任何学习逻辑。
 * P1 起本文件被真正的 PracticeScreen 流程替换。
 */

import { CONTRACT_VERSION } from '../core/contracts.js';
import { createRng } from '../core/seedRandom.js';
import { listQuestionTypes } from '../questionTypes/registry.js';
import { MemoryAdapter } from '../storage/MemoryAdapter.js';
import { STORE_NAMES } from '../storage/schema.js';

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * @param {{stores: string[], types: import('../questionTypes/QuestionType.js').QuestionTypeMeta[], seedProbe: number}} input
 * @returns {string}
 */
function renderStatusPage({ stores, types, seedProbe }) {
  const typeItems = types.map((type) => `
    <li class="sw-type">
      <span class="sw-type__id">${escapeHtml(type.id)}</span>
      <span class="sw-type__task">${escapeHtml(type.task)}</span>
      <span class="sw-type__phase">${escapeHtml(type.phase)}</span>
    </li>
  `).join('');

  return `
    <div class="sw-shell">
      <header class="sw-hero">
        <div class="sw-hero__top">
          <p class="sw-eyebrow">P0 · CONTRACTS &amp; SKELETON</p>
          <span class="sw-badge">开发预览</span>
        </div>
        <h1 class="sw-title">SpellWell <span class="sw-title__cn">拼写小屋</span></h1>
        <p class="sw-lede">看词 → 拼写 → 判定 → 调度。只有拼写，没有积分，没有排行榜。</p>
        <div class="sw-hero__meta">
          <span>契约 v${CONTRACT_VERSION}</span>
          <span>9 个题型已注册</span>
          <span>${stores.length} 个存储集合</span>
          <span>seed 可复现</span>
        </div>
      </header>

      <section class="sw-grid" aria-label="P0 自检">
        <article class="sw-card">
          <p class="sw-card__label">当前阶段</p>
          <p class="sw-card__value">P0 <span class="sw-card__suffix">骨架</span></p>
          <p class="sw-card__note">下一步 P1：最小拼写闭环</p>
        </article>
        <article class="sw-card">
          <p class="sw-card__label">题型注册表</p>
          <p class="sw-card__value">${types.length}<span class="sw-card__suffix">/ 9</span></p>
          <p class="sw-card__note">build / judge 尚未实现（按阶段）</p>
        </article>
        <article class="sw-card">
          <p class="sw-card__label">存储适配器</p>
          <p class="sw-card__value">Memory</p>
          <p class="sw-card__note">刷新即丢；P2 接 IndexedDB</p>
        </article>
        <article class="sw-card">
          <p class="sw-card__label">随机探针</p>
          <p class="sw-card__value">${seedProbe}</p>
          <p class="sw-card__note">同 seed 必得同序列</p>
        </article>
      </section>

      <section class="sw-panel">
        <div class="sw-panel__head">
          <h2>视觉语言样片</h2>
          <span class="sw-panel__hint">静态样片 · 题型实现于 P1 接入</span>
        </div>
        <div class="sw-preview" aria-hidden="true">
          <div class="sw-preview__slots">
            <span class="sw-slot sw-slot--filled">f</span>
            <span class="sw-slot sw-slot--filled">i</span>
            <span class="sw-slot sw-slot--filled sw-slot--focus">sh</span>
          </div>
          <div class="sw-preview__tiles">
            <span class="sw-tile">sh</span>
            <span class="sw-tile">f</span>
            <span class="sw-tile">i</span>
          </div>
          <p class="sw-preview__caption">字母块点选后填入槽位 · 200ms 弹性缓动</p>
        </div>
      </section>

      <section class="sw-panel">
        <div class="sw-panel__head">
          <h2>题型注册表</h2>
          <span class="sw-panel__hint">DESIGN §3.4 · 顺序锁定</span>
        </div>
        <ul class="sw-type-list">${typeItems}</ul>
      </section>

      <section class="sw-panel">
        <div class="sw-panel__head">
          <h2>阶段门禁</h2>
          <span class="sw-panel__hint">P0 不通过不进入 P1</span>
        </div>
        <ol class="sw-phases" aria-label="P0 到 P10">
          ${Array.from({ length: 11 }, (_, index) => {
            const phase = `P${index}`;
            const stateClass = index === 0 ? 'is-done' : index === 1 ? 'is-next' : '';
            return `<li class="sw-phase ${stateClass}"><span>${phase}</span><small>${index === 0 ? '完成' : index === 1 ? '下一步' : '计划'}</small></li>`;
          }).join('')}
        </ol>
        <p class="sw-command">验收：<code>node tests/runTests.js --phase=p0</code></p>
      </section>

      <footer class="sw-footer">
        <p>学习端将保持纯英文；本页是 P0 开发预览，不面向孩子。</p>
        <p>内容种子全部 <code>unreviewed</code>，仅用于开发。</p>
      </footer>
    </div>
  `;
}

/**
 * @param {HTMLElement} root
 * @returns {Promise<void>}
 */
export async function mountApp(root) {
  if (!root) throw new Error('mountApp requires a root element');

  const adapter = new MemoryAdapter();
  await adapter.init();
  const types = listQuestionTypes();
  const seedProbe = createRng(20261111).int(1000, 9999);

  root.innerHTML = renderStatusPage({
    stores: [...STORE_NAMES],
    types,
    seedProbe,
  });
  root.dataset.phase = 'P0';
}
