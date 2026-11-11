/**
 * @layer admin
 * @phase P9
 * @doc §2.3 内容后台
 *
 * 练习设置：题量由后台决定，前台不选。只写 meta.practiceSettings。
 */

import { IndexedDBAdapter } from '../storage/IndexedDBAdapter.js';
import {
  MAX_PRACTICE_QUESTIONS,
  MIN_PRACTICE_QUESTIONS,
  normalizePracticeSettings,
  readPracticeSettings,
  savePracticeSettings,
} from '../storage/practiceSettings.js';

function escape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
 * @param {HTMLElement} root
 */
export async function mountPracticeSettings(root) {
  const adapter = new IndexedDBAdapter();
  await adapter.init();
  let settings;
  try {
    settings = await readPracticeSettings(adapter);
  } catch {
    settings = normalizePracticeSettings({});
  }
  let message = '';

  const render = () => {
    root.innerHTML = `
      <nav class="sw-admin__breadcrumb" aria-label="Breadcrumb">
        <a href="/src/admin/index.html">内容库</a><span>/</span><strong>练习设置</strong>
      </nav>
      <section class="sw-panel">
        <h2>练习设置</h2>
        <p class="sw-admin__muted">前台不选题量；这里决定每次练习的题目数量。</p>
        <form class="sw-admin__settings" data-settings-form>
          <label>每次练习题目数
            <input type="number" name="questions" min="${MIN_PRACTICE_QUESTIONS}" max="${MAX_PRACTICE_QUESTIONS}" value="${settings.questionsPerPractice}" required />
            <small>范围 ${MIN_PRACTICE_QUESTIONS}—${MAX_PRACTICE_QUESTIONS}，默认 20</small>
          </label>
          <label>默认模式
            <select name="mode">
              <option value="review" ${settings.defaultMode === 'review' ? 'selected' : ''}>复习（Review）</option>
              <option value="effort" ${settings.defaultMode === 'effort' ? 'selected' : ''}>努力（Effort）</option>
            </select>
          </label>
          <button type="submit" class="sw-check">保存设置</button>
        </form>
        ${message ? `<p class="sw-admin__notice">${escape(message)}</p>` : ''}
      </section>
    `;
    root.querySelector('[data-settings-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        const next = normalizePracticeSettings({
          questionsPerPractice: Number(new FormData(form).get('questions')),
          defaultMode: String(new FormData(form).get('mode')),
        });
        settings = await savePracticeSettings(adapter, next);
        if (typeof BroadcastChannel === 'function') {
          const channel = new BroadcastChannel('spellwell-content');
          channel.postMessage({ type: 'content-updated', settings: true });
          channel.close();
        }
        message = '已保存；下一次练习生效。';
      } catch (error) {
        message = `保存失败：${String(error.message ?? error)}`;
      }
      render();
    });
  };

  render();
}
