/**
 * @layer admin
 * @phase P7
 * @doc §2.3 内容后台
 *
 * 只读内容校验与导出控制台。不 import 仓库、不写 wordStates/graphemeStates/attempts。
 */

import { buildExport, validateContent } from './ContentValidator.js';

/**
 * @param {string} name
 * @returns {Promise<any>}
 */
async function load(name) {
  const response = await fetch(new URL(`../content/${name}.json`, import.meta.url));
  if (!response.ok) throw new Error(`HTTP ${response.status} loading ${name}`);
  return response.json();
}

/**
 * @returns {Promise<any>}
 */
async function loadAll() {
  const [words, graphemes, sentences, confusables] = await Promise.all([
    load('words'),
    load('graphemes'),
    load('sentences'),
    load('confusables'),
  ]);
  return { words, graphemes, sentences, confusables };
}

/**
 * @param {HTMLElement} root
 */
export async function mountAdmin(root) {
  if (!root) throw new Error('AdminApp needs a root element');
  root.innerHTML = '<p class="sw-lede">正在加载内容并执行 V1—V10…</p>';
  let content;
  try {
    content = await loadAll();
  } catch (error) {
    root.innerHTML = `<section class="sw-panel"><h2>加载失败</h2><pre>${String(error)}</pre></section>`;
    return;
  }

  const report = validateContent(content);
  let exportError = null;
  try {
    buildExport(content);
  } catch (error) {
    exportError = error;
  }

  const counts = Object.entries(report.counts)
    .map(([name, count]) => `<li><strong>${name}</strong> ${count}</li>`)
    .join('');
  const issues = report.errors.length > 0
    ? `<ul class="sw-admin__errors">${report.errors.map((item) => `<li><code>${item.code}</code> ${item.path} — ${item.message}</li>`).join('')}</ul>`
    : '<p class="sw-admin__ok">V1—V9 通过。</p>';
  const exportNote = exportError
    ? `<p class="sw-admin__blocked">导出阻断：<code>${exportError.code}</code>，${exportError.details?.unreviewed?.length ?? 0} 条内容不是 reviewed。</p>`
    : '<p class="sw-admin__ok">V10 通过：可以导出 reviewed 内容。</p>';

  root.innerHTML = `
    <section class="sw-panel">
      <h2>校验结果</h2>
      <ul class="sw-admin__counts">${counts}</ul>
      ${issues}
      ${exportNote}
      <button type="button" class="sw-check" data-admin-export ${exportError ? 'disabled' : ''}>导出 reviewed JSON</button>
    </section>
  `;

  const button = root.querySelector('[data-admin-export]');
  button?.addEventListener('click', () => {
    try {
      const snapshot = buildExport(content);
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'spellwell-content-reviewed.json';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      root.querySelector('[data-admin-export]')?.setAttribute('disabled', '');
      console.error(error);
    }
  });
}
