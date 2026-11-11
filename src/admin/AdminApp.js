/**
 * @layer admin
 * @phase P7
 * @doc §2.3 内容后台
 *
 * 单词库/unit 切分编辑器 + 校验 + 本地 IndexedDB 保存 + reviewed-only 导出。
 * 不 import 状态仓库、不写 wordStates/graphemeStates/attempts。
 */

import { IndexedDBAdapter } from '../storage/IndexedDBAdapter.js';
import {
  addUnit,
  addWord,
  nextWordId,
  removeUnit,
  updateUnit,
  updateWord,
} from './ContentEditor.js';
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

async function loadAll() {
  const [words, graphemes, sentences, confusables] = await Promise.all([
    load('words'), load('graphemes'), load('sentences'), load('confusables'),
  ]);
  return { words, graphemes, sentences, confusables };
}

function download(name, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
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

  let selectedWordId = content.words.items[0]?.id ?? null;
  let notice = '';

  const render = () => {
    const report = validateContent(content);
    let exportError = null;
    try {
      buildExport(content);
    } catch (error) {
      exportError = error;
    }
    const word = content.words.items.find((item) => item.id === selectedWordId) ?? null;
    const counts = Object.entries(report.counts)
      .map(([name, count]) => `<li><strong>${name}</strong> ${count}</li>`)
      .join('');
    const issues = report.errors.length > 0
      ? `<ul class="sw-admin__errors">${report.errors.map((item) => `<li><code>${item.code}</code> ${item.path} — ${item.message}</li>`).join('')}</ul>`
      : '<p class="sw-admin__ok">V1—V9 通过。</p>';

    const units = word
      ? (word.units ?? []).map((unit, index) => `
        <tr data-unit-row="${index}">
          <td><input data-unit-text="${index}" value="${unit.text}" size="4" /></td>
          <td>
            <select data-unit-grapheme="${index}">
              ${content.graphemes.items.map((item) => `<option value="${item.id}" ${item.id === unit.graphemeId ? 'selected' : ''}>${item.id} · ${item.text}</option>`).join('')}
            </select>
          </td>
          <td><button type="button" class="sw-text-button" data-remove-unit="${index}">删除</button></td>
        </tr>
      `).join('')
      : '';

    root.innerHTML = `
      <section class="sw-panel">
        <h2>内容概览</h2>
        <ul class="sw-admin__counts">${counts}</ul>
        ${issues}
        ${notice ? `<p class="sw-admin__notice">${notice}</p>` : ''}
      </section>

      <section class="sw-panel">
        <h2>单词库与 unit 切分</h2>
        <div class="sw-admin__toolbar">
          <select data-word-select>
            ${content.words.items.map((item) => `<option value="${item.id}" ${item.id === selectedWordId ? 'selected' : ''}>${item.id} · ${item.text}</option>`).join('')}
          </select>
          <button type="button" class="sw-text-button" data-add-word>新增单词</button>
        </div>
        ${word ? `
          <div class="sw-admin__word">
            <label>ID <input data-word-id value="${word.id}" readonly /></label>
            <label>Text <input data-word-text value="${word.text}" /></label>
            <label>Level
              <select data-word-level>
                <option value="1" ${word.level === 1 ? 'selected' : ''}>1</option>
                <option value="2" ${word.level === 2 ? 'selected' : ''}>2</option>
              </select>
            </label>
            <label>Review
              <select data-word-review>
                ${['unreviewed', 'reviewed', 'retired'].map((status) => `<option value="${status}" ${word.reviewStatus === status ? 'selected' : ''}>${status}</option>`).join('')}
              </select>
            </label>
          </div>
          <table class="sw-admin__units">
            <thead><tr><th>unit 文本</th><th>grapheme</th><th></th></tr></thead>
            <tbody>${units}</tbody>
          </table>
          <div class="sw-admin__toolbar">
            <button type="button" class="sw-text-button" data-add-unit>新增 unit</button>
            <button type="button" class="sw-check" data-save-word>保存单词</button>
          </div>
        ` : '<p>没有单词。点击“新增单词”。</p>'}
      </section>

      <section class="sw-panel">
        <h2>保存与导出</h2>
        <p>保存到本机 IndexedDB 后，刷新学习端即可看到修改（共享同源数据库）。</p>
        <p class="sw-admin__blocked">${exportError ? `导出阻断：<code>${exportError.code}</code>，${exportError.details?.unreviewed?.length ?? 0} 条内容不是 reviewed。` : 'V10 通过：可以导出 reviewed 内容。'}</p>
        <div class="sw-admin__toolbar">
          <button type="button" class="sw-text-button" data-persist>保存到 IndexedDB</button>
          <button type="button" class="sw-text-button" data-download-draft>下载当前草稿</button>
          <button type="button" class="sw-check" data-export ${exportError ? 'disabled' : ''}>导出 reviewed JSON</button>
        </div>
      </section>
    `;

    root.querySelector('[data-word-select]')?.addEventListener('change', (event) => {
      selectedWordId = event.target.value;
      notice = '';
      render();
    });
    root.querySelector('[data-add-word]')?.addEventListener('click', () => {
      const text = prompt('新单词（小写字母）:', 'word');
      if (!text) return;
      const normalized = String(text).trim().toLowerCase();
      const word = addWord(content, {
        id: nextWordId(content, normalized),
        text: normalized,
        level: 1,
        units: [],
        reviewStatus: 'unreviewed',
      });
      selectedWordId = word.id;
      notice = '已新增，尚未保存到 IndexedDB。';
      render();
    });
    if (word) {
      root.querySelector('[data-add-unit]')?.addEventListener('click', () => {
        addUnit(word, { text: '', graphemeId: content.graphemes.items[0]?.id ?? '' });
        notice = '已新增 unit，请填写文本并选择 grapheme。';
        render();
      });
      for (const button of root.querySelectorAll('[data-remove-unit]')) {
        button.addEventListener('click', () => {
          removeUnit(word, Number(button.dataset.removeUnit));
          notice = '已删除 unit。';
          render();
        });
      }
      root.querySelector('[data-save-word]')?.addEventListener('click', () => {
        const text = root.querySelector('[data-word-text]').value.trim().toLowerCase();
        const level = Number(root.querySelector('[data-word-level]').value);
        const reviewStatus = root.querySelector('[data-word-review]').value;
        updateWord(content, word.id, { text, level, reviewStatus });
        for (const row of root.querySelectorAll('[data-unit-row]')) {
          const index = Number(row.dataset.unitRow);
          const unitText = root.querySelector(`[data-unit-text="${index}"]`).value;
          const graphemeId = root.querySelector(`[data-unit-grapheme="${index}"]`).value;
          updateUnit(word, index, { text: unitText, graphemeId });
        }
        notice = '单词已修改（内存中）；请保存到 IndexedDB。';
        render();
      });
    }
    root.querySelector('[data-persist]')?.addEventListener('click', async () => {
      try {
        const adapter = new IndexedDBAdapter();
        await adapter.init();
        await adapter.transaction(
          ['words', 'graphemes', 'sentences', 'confusables', 'meta'],
          async (tx) => {
            for (const store of ['words', 'graphemes', 'sentences', 'confusables']) {
              for (const item of content[store].items) await tx.put(store, item);
            }
            await tx.put('meta', { key: 'contentVersion', value: 1 });
          },
        );
        await adapter.close();
        notice = '已保存到 IndexedDB；刷新学习端即可看到。';
      } catch (error) {
        notice = `保存失败：${String(error)}`;
      }
      render();
    });
    root.querySelector('[data-download-draft]')?.addEventListener('click', () => {
      download('spellwell-content-draft.json', content);
    });
    root.querySelector('[data-export]')?.addEventListener('click', () => {
      try {
        download('spellwell-content-reviewed.json', buildExport(content));
      } catch (error) {
        notice = `导出失败：${error.code}`;
        render();
      }
    });
  };

  render();
}
