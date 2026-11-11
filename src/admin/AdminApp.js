/**
 * @layer admin
 * @phase P7
 * @doc §2.3 内容后台
 *
 * 交互：左侧单词列表/搜索/新增；右侧编辑 word + unit 切分；保存到与学习端共享的 IndexedDB。
 * 不 import 状态仓库、不写 wordStates/graphemeStates/attempts，不做学习数据迁移。
 */

import { IndexedDBAdapter } from '../storage/IndexedDBAdapter.js';
import {
  addUnit,
  addWord,
  cloneContent,
  nextWordId,
  removeUnit,
  updateUnit,
  updateWord,
} from './ContentEditor.js';
import { buildExport, validateContent } from './ContentValidator.js';

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

function escape(value) {
  return String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}


/**
 * @param {HTMLElement} root
 */
export async function mountAdmin(root) {
  if (!root) throw new Error('AdminApp needs a root element');
  root.innerHTML = '<p class="sw-lede">正在加载内容…</p>';

  let content;
  try {
    content = await loadAll();
  } catch (error) {
    root.innerHTML = `<section class="sw-panel"><h2>加载失败</h2><pre>${escape(error)}</pre></section>`;
    return;
  }

  let saved = cloneContent(content);
  let selectedWordId = content.words.items[0]?.id ?? null;
  let adding = false;
  let notice = '';

  const currentWord = () => content.words.items.find((item) => item.id === selectedWordId) ?? null;
  const savedWord = (id) => saved.words.items.find((item) => item.id === id) ?? null;
  const isDirty = (word) => word && JSON.stringify(word) !== JSON.stringify(savedWord(word.id));
  const anyDirty = () => content.words.items.some((word) => isDirty(word));

  const render = () => {
    const report = validateContent(content);
    let exportError = null;
    try { buildExport(content); } catch (error) { exportError = error; }
    const word = currentWord();
    const filtered = content.words.items;
    const dirty = isDirty(word);

    const wordItems = filtered.map((item) => {
      const active = item.id === selectedWordId;
      const wordDirty = isDirty(item);
      return `
        <li>
          <button type="button" class="sw-admin__word-item ${active ? 'is-active' : ''}" data-select-word="${escape(item.id)}">
            <span class="sw-admin__word-text">${escape(item.text)}</span>
            <span class="sw-admin__word-meta">${escape(item.id)} · ${escape(item.reviewStatus)}${wordDirty ? ' · 未保存' : ''}</span>
          </button>
        </li>
      `;
    }).join('');

    const units = word
      ? (word.units ?? []).map((unit, index) => `
        <tr data-unit-row="${index}">
          <td><span class="sw-admin__unit-index">${index + 1}</span></td>
          <td><input data-unit-text="${index}" value="${escape(unit.text)}" size="3" aria-label="unit ${index + 1} text" /></td>
          <td>
            <select data-unit-grapheme="${index}" aria-label="unit ${index + 1} grapheme">
              ${content.graphemes.items.map((g) => `<option value="${g.id}" ${g.id === unit.graphemeId ? 'selected' : ''}>${escape(g.id)} · ${escape(g.text)}</option>`).join('')}
            </select>
          </td>
          <td><button type="button" class="sw-admin__icon-button" data-remove-unit="${index}" aria-label="Delete unit ${index + 1}">×</button></td>
        </tr>
      `).join('')
      : '';
    const joined = (word?.units ?? []).map((unit) => unit.text).join('');
    const joinOk = word && joined === word.text;

    const issueItems = report.errors.length > 0
      ? `<ul class="sw-admin__errors">${report.errors.slice(0, 8).map((item) => `<li><code>${escape(item.code)}</code> ${escape(item.path)} — ${escape(item.message)}</li>`).join('')}${report.errors.length > 8 ? `<li>…还有 ${report.errors.length - 8} 条</li>` : ''}</ul>`
      : '<p class="sw-admin__ok">V1—V9 通过。</p>';

    root.innerHTML = `
      <section class="sw-panel sw-admin__overview">
        <div>
          <h2>内容概览</h2>
          <p class="sw-admin__muted">words ${content.words.items.length} · graphemes ${content.graphemes.items.length} · sentences ${content.sentences.items.length} · confusables ${content.confusables.items.length}</p>
        </div>
        <div class="sw-admin__overview-actions">
          <a class="sw-text-button" href="/migration/index.html">本机数据迁移</a>
          <span class="sw-admin__badge ${report.valid ? 'is-ok' : 'is-bad'}">${report.valid ? 'V1—V9 通过' : `${report.errors.length} 个问题`}</span>
        </div>
      </section>

      <div class="sw-admin__layout">
        <aside class="sw-panel sw-admin__sidebar">
          <div class="sw-admin__sidebar-head">
            <input type="search" data-word-search placeholder="搜索单词…" aria-label="Search words" />
            <button type="button" class="sw-check" data-add-word>+ 新增</button>
          </div>
          ${adding ? `
            <form class="sw-admin__add-form" data-add-form>
              <input name="text" placeholder="新单词，如 ship" autocomplete="off" />
              <button type="submit" class="sw-text-button">创建</button>
              <button type="button" class="sw-text-button" data-cancel-add>取消</button>
            </form>
          ` : ''}
          <ul class="sw-admin__word-list">${wordItems || '<li class="sw-admin__muted">没有匹配单词</li>'}</ul>
        </aside>

        <section class="sw-panel sw-admin__editor">
          ${word ? `
            <div class="sw-admin__editor-head">
              <div>
                <p class="sw-eyebrow">WORD</p>
                <h2>${escape(word.id)}</h2>
              </div>
              <div class="sw-admin__editor-actions">
                ${dirty ? '<span class="sw-admin__badge is-warn">未保存</span>' : '<span class="sw-admin__badge is-ok">已同步</span>'}
                <button type="button" class="sw-text-button" data-revert ${dirty ? '' : 'disabled'}>撤销</button>
                <button type="button" class="sw-check" data-save-word>保存到本机</button>
              </div>
            </div>

            <div class="sw-admin__field-row">
              <label>单词 <input data-word-text value="${escape(word.text)}" /></label>
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

            <div class="sw-admin__unit-head">
              <h3>Unit 切分</h3>
              <span class="${joinOk ? 'sw-admin__ok' : 'sw-admin__blocked'}">${joinOk ? '拼接一致' : `拼接为“${escape(joined)}”，与单词不一致`}</span>
            </div>
            <table class="sw-admin__units">
              <thead><tr><th>#</th><th>文本</th><th>grapheme</th><th></th></tr></thead>
              <tbody>${units || '<tr><td colspan="4" class="sw-admin__muted">尚未切分，点击“新增 unit”。</td></tr>'}</tbody>
            </table>
            <div class="sw-admin__unit-actions">
              <button type="button" class="sw-text-button" data-add-unit>+ 新增 unit</button>
              <span class="sw-admin__muted">切分只人工；不自动推断 grapheme。</span>
            </div>
          ` : '<p>没有单词，先新增一个。</p>'}

          <details class="sw-admin__validation">
            <summary>内容校验 ${exportError ? '· 导出仍阻断' : '· 可发布'}</summary>
            ${issueItems}
            <p class="sw-admin__muted">${exportError ? `导出阻断：${escape(exportError.code)}，${exportError.details?.unreviewed?.length ?? 0} 条不是 reviewed。` : 'V10 通过。'}</p>
          </details>
          ${notice ? `<p class="sw-admin__notice">${escape(notice)}</p>` : ''}
        </section>
      </div>
    `;

    // Word list filtering without re-rendering/focus loss.
    const search = root.querySelector('[data-word-search]');
    search?.addEventListener('input', () => {
      const query = search.value.trim().toLowerCase();
      for (const button of root.querySelectorAll('[data-select-word]')) {
        const id = String(button.dataset.selectWord).toLowerCase();
        const text = button.querySelector('.sw-admin__word-text')?.textContent?.toLowerCase() ?? '';
        button.parentElement.style.display = !query || id.includes(query) || text.includes(query) ? '' : 'none';
      }
    });

    for (const button of root.querySelectorAll('[data-select-word]')) {
      button.addEventListener('click', () => {
        if (adding) return;
        selectedWordId = button.dataset.selectWord;
        notice = '';
        render();
      });
    }
    root.querySelector('[data-add-word]')?.addEventListener('click', () => {
      adding = true;
      render();
      root.querySelector('[data-add-form] input')?.focus();
    });
    root.querySelector('[data-cancel-add]')?.addEventListener('click', () => { adding = false; render(); });
    root.querySelector('[data-add-form]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const text = String(new FormData(form).get('text') ?? '').trim().toLowerCase();
      if (!/^[a-z]+$/.test(text)) { notice = '新单词只接受小写字母。'; render(); return; }
      const created = addWord(content, {
        id: nextWordId(content, text),
        text,
        level: 1,
        units: [],
        reviewStatus: 'unreviewed',
      });
      selectedWordId = created.id;
      adding = false;
      notice = '已创建，请添加 unit 切分后保存。';
      render();
    });

    if (word) {
      root.querySelector('[data-add-unit]')?.addEventListener('click', () => {
        addUnit(word, { text: '', graphemeId: content.graphemes.items[0]?.id ?? '' });
        notice = '已新增 unit；填写文本并选择 grapheme。';
        render();
      });
      for (const button of root.querySelectorAll('[data-remove-unit]')) {
        button.addEventListener('click', () => {
          removeUnit(word, Number(button.dataset.removeUnit));
          notice = '已删除 unit。';
          render();
        });
      }
      root.querySelector('[data-revert]')?.addEventListener('click', () => {
        const baseline = savedWord(word.id);
        if (baseline) Object.assign(word, cloneContent(baseline));
        notice = '已撤销未保存修改。';
        render();
      });
      root.querySelector('[data-save-word]')?.addEventListener('click', async () => {
        const text = root.querySelector('[data-word-text]').value.trim().toLowerCase();
        updateWord(content, word.id, {
          text,
          level: Number(root.querySelector('[data-word-level]').value),
          reviewStatus: root.querySelector('[data-word-review]').value,
        });
        for (const row of root.querySelectorAll('[data-unit-row]')) {
          const index = Number(row.dataset.unitRow);
          updateUnit(word, index, {
            text: root.querySelector(`[data-unit-text="${index}"]`).value,
            graphemeId: root.querySelector(`[data-unit-grapheme="${index}"]`).value,
          });
        }
        const report = validateContent(content);
        if (!report.valid) {
          notice = '校验未通过，未写入本机数据库。请先修复切分/引用问题。';
          render();
          return;
        }
        try {
          const adapter = new IndexedDBAdapter();
          await adapter.init();
          await adapter.transaction(['words', 'graphemes', 'sentences', 'confusables', 'meta'], async (tx) => {
            for (const store of ['words', 'graphemes', 'sentences', 'confusables']) {
              for (const item of content[store].items) await tx.put(store, item);
            }
            await tx.put('meta', { key: 'contentVersion', value: 1 });
          });
          await adapter.close();
          saved = cloneContent(content);
          if (typeof BroadcastChannel === 'function') {
            const channel = new BroadcastChannel('spellwell-content');
            channel.postMessage({ type: 'content-updated', wordId: word.id });
            channel.close();
          }
          notice = '已保存到本机 IndexedDB；学习端会提示刷新。';
        } catch (error) {
          notice = `保存失败：${String(error)}`;
        }
        render();
      });
    }
  };

  window.addEventListener('beforeunload', (event) => {
    if (anyDirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  render();
}
