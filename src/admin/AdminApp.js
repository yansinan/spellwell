/**
 * @layer admin
 * @phase P7
 * @doc §2.3 内容后台
 *
 * 交互：搜索/列表 + 单词编辑器 + 批量导入；逗号切分、自动切分建议、翻译/音标。
 * 保存直接写与学习端共享的 IndexedDB；内容导出/导入不属于后台。
 */

import { IndexedDBAdapter } from '../storage/IndexedDBAdapter.js';
import { CONTENT_VERSION, importContent, readContentVersion } from '../storage/contentImport.js';
import {
  addWord,
  applySegments,
  cloneContent,
  deleteWord,
  nextWordId,
  updateWord,
} from './ContentEditor.js';
import { buildExport, validateContent } from './ContentValidator.js';
import { autoSegment, parseBatch } from './WordImporter.js';

async function load(name) {
  const response = await fetch(new URL(`../content/${name}.json`, import.meta.url));
  if (!response.ok) throw new Error(`HTTP ${response.status} loading ${name}`);
  return response.json();
}

async function loadStatic() {
  const [words, graphemes, sentences, confusables] = await Promise.all([
    load('words'), load('graphemes'), load('sentences'), load('confusables'),
  ]);
  return { words, graphemes, sentences, confusables };
}

async function openContent() {
  const adapter = new IndexedDBAdapter();
  try {
    await adapter.init();
  } catch (error) {
    return { adapter: null, content: await loadStatic(), error };
  }
  let version = await readContentVersion(adapter);
  if (version !== CONTENT_VERSION) {
    const staticContent = await loadStatic();
    await importContent(adapter, { ...staticContent, version: CONTENT_VERSION });
    version = CONTENT_VERSION;
  }
  const [words, graphemes, sentences, confusables] = await Promise.all([
    adapter.query('words', {}), adapter.query('graphemes', {}),
    adapter.query('sentences', {}), adapter.query('confusables', {}),
  ]);
  return {
    adapter,
    content: {
      words: { version, items: words },
      graphemes: { version, items: graphemes },
      sentences: { version, items: sentences },
      confusables: { version, items: confusables },
    },
  };
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
  let adapter = null;
  try {
    const opened = await openContent();
    content = opened.content;
    adapter = opened.adapter;
  } catch (error) {
    root.innerHTML = `<section class="sw-panel"><h2>加载失败</h2><pre>${escape(error)}</pre></section>`;
    return;
  }

  let saved = cloneContent(content);
  let selectedWordId = content.words.items[0]?.id ?? null;
  let adding = false;
  let batchOpen = false;
  let batchText = '';
  let batchPreview = null;
  let notice = '';

  const graphemeByText = () => Object.fromEntries(content.graphemes.items.map((item) => [item.text, item.id]));
  const currentWord = () => content.words.items.find((item) => item.id === selectedWordId) ?? null;
  const savedWord = (id) => saved.words.items.find((item) => item.id === id) ?? null;
  const isDirty = (word) => word && JSON.stringify(word) !== JSON.stringify(savedWord(word.id));
  const anyDirty = () => content.words.items.some((word) => isDirty(word));

  const segmentChips = (tokens) => {
    const map = graphemeByText();
    return tokens.map((token) => {
      const text = String(token).trim().toLowerCase();
      const id = map[text];
      return `<span class="sw-admin__chip ${id ? '' : 'is-invalid'}">${escape(text || '·')}${id ? '' : '?'}</span>`;
    }).join('<span class="sw-admin__chip-sep">|</span>');
  };

  const parseSegments = (value) => String(value).split(',').map((token) => token.trim().toLowerCase()).filter(Boolean);

  const persistContent = async () => {
    const report = validateContent(content);
    if (!report.valid) return false;
    if (!adapter) throw new Error('本机 IndexedDB 不可用，不能保存');
    await adapter.transaction(['words', 'graphemes', 'sentences', 'confusables', 'meta'], async (tx) => {
      for (const store of ['words', 'graphemes', 'sentences', 'confusables']) {
        for (const item of content[store].items) await tx.put(store, item);
      }
      await tx.put('meta', { key: 'contentVersion', value: CONTENT_VERSION });
    });
    saved = cloneContent(content);
    if (typeof BroadcastChannel === 'function') {
      const channel = new BroadcastChannel('spellwell-content');
      channel.postMessage({ type: 'content-updated' });
      channel.close();
    }
    return true;
  };

  const render = () => {
    const report = validateContent(content);
    let exportError = null;
    try { buildExport(content); } catch (error) { exportError = error; }
    const word = currentWord();
    const dirty = isDirty(word);
    const tokens = word ? (word.units ?? []).map((unit) => unit.text) : [];
    const wordItems = content.words.items.map((item) => {
      const active = item.id === selectedWordId;
      const wordDirty = isDirty(item);
      const translation = item.translation ? ` · ${escape(item.translation)}` : '';
      return `
        <li>
          <button type="button" class="sw-admin__word-item ${active ? 'is-active' : ''}" data-select-word="${escape(item.id)}">
            <span class="sw-admin__word-text">${escape(item.text)}${translation}</span>
            <span class="sw-admin__word-meta">${escape(item.id)} · ${escape(item.reviewStatus)}${wordDirty ? ' · 未保存' : ''}</span>
          </button>
        </li>
      `;
    }).join('');

    let batchPreviewHtml = '';
    let batchNewEntries = [];
    if (batchPreview) {
      const existingTexts = new Set(content.words.items.map((item) => item.text));
      const seen = new Set();
      batchNewEntries = batchPreview.entries.filter((entry) => {
        if (existingTexts.has(entry.text) || seen.has(entry.text)) return false;
        seen.add(entry.text);
        return true;
      });
      const existingCount = batchPreview.entries.length - batchNewEntries.length;
      const rows = batchPreview.entries.map((entry) => {
        const duplicate = existingTexts.has(entry.text) || !batchNewEntries.includes(entry);
        return `
          <tr class="${duplicate ? 'is-muted' : ''}">
            <td><strong>${escape(entry.text)}</strong></td>
            <td>${entry.units.map((unit) => escape(unit.text)).join(' · ')}</td>
            <td>${escape(entry.translation || '—')}</td>
            <td>${escape(entry.phonetic || '—')}</td>
            <td>${duplicate ? '已存在/重复，跳过' : '将新增'}</td>
          </tr>
        `;
      }).join('');
      const errors = batchPreview.errors.map((error) => `<li>第 ${error.line} 行：${escape(error.message)}</li>`).join('');
      batchPreviewHtml = `
        <div class="sw-admin__batch-preview">
          <p>可新增 <strong>${batchNewEntries.length}</strong> 个；跳过 ${existingCount} 个；错误 ${batchPreview.errors.length} 个。</p>
          ${rows ? `<table class="sw-admin__units"><thead><tr><th>词</th><th>切分</th><th>中文</th><th>音标</th><th>状态</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
          ${errors ? `<ul class="sw-admin__errors">${errors}</ul>` : ''}
          <button type="button" class="sw-check" data-batch-commit ${batchNewEntries.length === 0 ? 'disabled' : ''}>加入并保存</button>
        </div>
      `;
    }

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

      <section class="sw-panel sw-admin__batch ${batchOpen ? 'is-open' : ''}">
        <div class="sw-admin__batch-head">
          <div>
            <h2>批量新增</h2>
            <p class="sw-admin__muted">每行一个词；逗号显式切分，无逗号自动切分；可追加中文/音标。</p>
          </div>
          <button type="button" class="sw-text-button" data-toggle-batch>${batchOpen ? '收起' : '展开'}</button>
        </div>
        ${batchOpen ? `
          <textarea data-batch-input rows="6" spellcheck="false" placeholder="w,ea,th,er | 天气 | /ˈweðər/\nweather | 天气 | /ˈweðər/\nfish">${escape(batchText)}</textarea>
          <div class="sw-admin__toolbar">
            <button type="button" class="sw-text-button" data-batch-preview>解析预览</button>
            <span class="sw-admin__muted">中文/音标可留空；“|”分隔词、中文、音标。</span>
          </div>
          ${batchPreviewHtml}
        ` : ''}
      </section>

      <div class="sw-admin__layout">
        <aside class="sw-panel sw-admin__sidebar">
          <div class="sw-admin__sidebar-head">
            <input type="search" data-word-search placeholder="搜索单词/中文…" aria-label="Search words" />
            <button type="button" class="sw-check" data-add-word>+ 新增</button>
          </div>
          ${adding ? `
            <form class="sw-admin__add-form" data-add-form>
              <input name="text" placeholder="新单词，如 ship" autocomplete="off" />
              <button type="submit" class="sw-text-button">创建</button>
              <button type="button" class="sw-text-button" data-cancel-add>取消</button>
            </form>
          ` : ''}
          <ul class="sw-admin__word-list">${wordItems || '<li class="sw-admin__muted">没有单词</li>'}</ul>
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
                <button type="button" class="sw-text-button" data-delete-word>删除</button>
                <button type="button" class="sw-check" data-save-word>保存到本机</button>
              </div>
            </div>

            <div class="sw-admin__field-row">
              <label>单词 <input data-word-text value="${escape(word.text)}" /></label>
              <label>中文 <input data-word-translation value="${escape(word.translation ?? '')}" placeholder="可选" /></label>
              <label>音标 <input data-word-phonetic value="${escape(word.phonetic ?? '')}" placeholder="可选，如 /ˈweðər/" /></label>
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
              <h3>切分</h3>
              <span class="${tokens.join('') === word.text ? 'sw-admin__ok' : 'sw-admin__blocked'}">${tokens.join('') === word.text ? '与单词一致' : `拼接为“${escape(tokens.join(''))}”`}</span>
            </div>
            <div class="sw-admin__segment-row">
              <input data-segment-input value="${escape(tokens.join(', '))}" placeholder="w, ea, th, er" aria-label="Comma separated units" />
              <button type="button" class="sw-text-button" data-auto-segment>自动切分</button>
              <button type="button" class="sw-text-button" data-letter-segment>按字母</button>
            </div>
            <div class="sw-admin__chips" data-segment-preview>${segmentChips(tokens)}</div>
            <p class="sw-admin__muted">用逗号切分单位；自动切分只是建议，保存前请确认。</p>
          ` : '<p>没有单词，先新增一个。</p>'}

          <details class="sw-admin__validation">
            <summary>内容校验 ${exportError ? '· 仍阻断' : '· 通过'}</summary>
            ${report.errors.length ? `<ul class="sw-admin__errors">${report.errors.slice(0, 8).map((item) => `<li><code>${escape(item.code)}</code> ${escape(item.path)} — ${escape(item.message)}</li>`).join('')}</ul>` : '<p class="sw-admin__ok">V1—V9 通过。</p>'}
            <p class="sw-admin__muted">${exportError ? `发布校验：${escape(exportError.code)}，${exportError.details?.unreviewed?.length ?? 0} 条不是 reviewed。` : '发布校验 V10 通过。'}</p>
          </details>
          ${notice ? `<p class="sw-admin__notice">${escape(notice)}</p>` : ''}
        </section>
      </div>
    `;

    const search = root.querySelector('[data-word-search]');
    search?.addEventListener('input', () => {
      const query = search.value.trim().toLowerCase();
      for (const button of root.querySelectorAll('[data-select-word]')) {
        const text = button.textContent?.toLowerCase() ?? '';
        button.parentElement.style.display = !query || text.includes(query) ? '' : 'none';
      }
    });

    for (const button of root.querySelectorAll('[data-select-word]')) {
      button.addEventListener('click', () => { selectedWordId = button.dataset.selectWord; notice = ''; render(); });
    }
    root.querySelector('[data-toggle-batch]')?.addEventListener('click', () => { batchOpen = !batchOpen; render(); });
    const batchInput = root.querySelector('[data-batch-input]');
    batchInput?.addEventListener('input', () => { batchText = batchInput.value; });
    root.querySelector('[data-batch-preview]')?.addEventListener('click', () => {
      batchPreview = parseBatch(batchText, graphemeByText());
      render();
    });
    root.querySelector('[data-batch-commit]')?.addEventListener('click', async () => {
      if (!batchPreview || batchNewEntries.length === 0) return;
      for (const entry of batchNewEntries) {
        addWord(content, {
          id: nextWordId(content, entry.text),
          text: entry.text,
          translation: entry.translation,
          phonetic: entry.phonetic,
          level: 1,
          units: entry.units,
          reviewStatus: 'unreviewed',
        });
      }
      const addedCount = batchNewEntries.length;
      selectedWordId = content.words.items[content.words.items.length - 1]?.id ?? selectedWordId;
      batchOpen = false;
      batchPreview = null;
      batchText = '';
      const ok = await persistContent();
      notice = ok ? `已批量加入并保存 ${addedCount} 个单词。` : '已加入草稿，但校验未通过，尚未写入本机数据库。';
      render();
    });

    root.querySelector('[data-add-word]')?.addEventListener('click', () => { adding = true; render(); root.querySelector('[data-add-form] input')?.focus(); });
    root.querySelector('[data-cancel-add]')?.addEventListener('click', () => { adding = false; render(); });
    root.querySelector('[data-add-form]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = String(new FormData(event.currentTarget).get('text') ?? '').trim().toLowerCase();
      if (!/^[a-z]+$/.test(text)) { notice = '新单词只接受小写字母。'; render(); return; }
      const created = addWord(content, { id: nextWordId(content, text), text, translation: '', phonetic: '', level: 1, units: [], reviewStatus: 'unreviewed' });
      selectedWordId = created.id;
      adding = false;
      notice = '已创建；填写切分后保存。';
      render();
    });

    if (word) {
      root.querySelector('[data-auto-segment]')?.addEventListener('click', () => {
        const text = root.querySelector('[data-word-text]').value.trim().toLowerCase();
        try {
          const units = autoSegment(text, graphemeByText());
          root.querySelector('[data-segment-input]').value = units.map((unit) => unit.text).join(', ');
          root.querySelector('[data-segment-preview]').innerHTML = segmentChips(units.map((unit) => unit.text));
          notice = '已生成自动切分建议；请确认后保存。';
        } catch (error) {
          notice = `自动切分失败：${String(error.message ?? error)}`;
        }
        const field = root.querySelector('[data-segment-input]');
        field.dispatchEvent(new Event('input', { bubbles: true }));
      });
      root.querySelector('[data-letter-segment]')?.addEventListener('click', () => {
        const text = root.querySelector('[data-word-text]').value.trim().toLowerCase();
        const tokens = [...text].filter((char) => /[a-z]/.test(char));
        if (!tokens.every((token) => graphemeByText()[token])) {
          notice = '按字母切分失败：字母库缺少对应字母。';
          return;
        }
        root.querySelector('[data-segment-input]').value = tokens.join(', ');
        root.querySelector('[data-segment-preview]').innerHTML = segmentChips(tokens);
        notice = '已按字母切分；请确认后保存。';
      });
      const segmentInput = root.querySelector('[data-segment-input]');
      segmentInput?.addEventListener('input', () => {
        const tokens = parseSegments(segmentInput.value);
        root.querySelector('[data-segment-preview]').innerHTML = segmentChips(tokens);
      });
      root.querySelector('[data-revert]')?.addEventListener('click', () => {
        const base = savedWord(word.id);
        if (base) Object.assign(word, cloneContent(base));
        notice = '已撤销未保存修改。';
        render();
      });
      root.querySelector('[data-delete-word]')?.addEventListener('click', () => {
        if (!window.confirm(`删除 ${word.id}？相关句子会成为悬空引用。`)) return;
        deleteWord(content, word.id);
        selectedWordId = content.words.items[0]?.id ?? null;
        notice = '已从草稿删除；保存到本机后生效。';
        render();
      });
      root.querySelector('[data-save-word]')?.addEventListener('click', async () => {
        const text = root.querySelector('[data-word-text]').value.trim().toLowerCase();
        const translation = root.querySelector('[data-word-translation]').value.trim();
        const phonetic = root.querySelector('[data-word-phonetic]').value.trim();
        const tokens = parseSegments(root.querySelector('[data-segment-input]').value);
        if (!/^[a-z]+$/.test(text)) { notice = '单词只接受小写字母。'; render(); return; }
        if (tokens.join('') !== text) { notice = '切分拼接必须等于单词。'; render(); return; }
        try {
          applySegments(word, tokens, graphemeByText());
        } catch (error) {
          notice = `切分失败：${String(error.message ?? error)}`;
          render();
          return;
        }
        updateWord(content, word.id, {
          text,
          translation,
          phonetic,
          level: Number(root.querySelector('[data-word-level]').value),
          reviewStatus: root.querySelector('[data-word-review]').value,
        });
        const ok = await persistContent();
        notice = ok ? '已保存到本机 IndexedDB；学习端会提示刷新。' : '校验未通过，尚未写入本机数据库。';
        render();
      });
    }
  };

  window.addEventListener('beforeunload', (event) => {
    if (anyDirty()) { event.preventDefault(); event.returnValue = ''; }
  });

  render();
}
