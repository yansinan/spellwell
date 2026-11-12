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
  importWord,
  nextWordId,
  updateWord,
} from './ContentEditor.js';
import { countAttemptsByWord } from './AttemptStats.js';
import { applyWordLibrary, buildWordLibrary, parseWordLibrary } from './WordLibrary.js';
import { DEFAULT_TEXTBOOK, TEXTBOOKS, readActiveTextbook, saveActiveTextbook, textbookLabel } from '../storage/textbooks.js';
import { buildExport, validateContent } from './ContentValidator.js';
import { autoSegment, parseBatch } from './WordImporter.js';
import { ADMIN_LEARNING_STATUSES, LearningStateService, deriveUnitStatus } from './LearningStateService.js';

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

const LEARNING_LABELS = Object.freeze({
  unstarted: '未开始',
  reviewing: '复习中',
  mastered: '已掌握',
  mixed: '混合',
  learning: '学习中',
  probe: '抽查中',
  '': '未设置',
});

function learningLabel(status) {
  return LEARNING_LABELS[status] ?? status;
}

function learningOptions(current, name) {
  const valid = ADMIN_LEARNING_STATUSES.includes(current);
  return `
    ${valid ? '' : `<option value="" selected>当前：${escape(learningLabel(current))}</option>`}
    ${ADMIN_LEARNING_STATUSES.map((status) => `<option value="${status}" ${current === status ? 'selected' : ''}>${learningLabel(status)}</option>`).join('')}
  `;
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
    const hint = window.location.protocol === 'file:'
      ? '当前是 file://；请先运行 node tools/serve.mjs，再打开 http://0.0.0.0:4173/admin'
      : '请确认静态服务器与同源 IndexedDB 可用。';
    root.innerHTML = `<section class="sw-panel"><h2>加载失败</h2><p>${escape(hint)}</p><pre>${escape(error)}</pre></section>`;
    return;
  }

  let activeTextbook = adapter ? await readActiveTextbook(adapter) : DEFAULT_TEXTBOOK;
  const activeWords = () => content.words.items.filter(
    (item) => (item.textbook ?? DEFAULT_TEXTBOOK) === activeTextbook,
  );
  let saved = cloneContent(content);
  let selectedWordId = activeWords()[0]?.id ?? null;
  let attemptStats = {};
  try {
    if (adapter) attemptStats = countAttemptsByWord(await adapter.query('attempts', {}));
  } catch {
    attemptStats = {};
  }
  const learningService = adapter ? new LearningStateService(adapter) : null;
  let learningStates = new Map();
  if (learningService) learningStates = await learningService.load();
  const selectedUnit = content.words.items.find((item) => item.id === selectedWordId)?.unitId;
  const collapsedLevels = new Set(activeWords().map((item) => String(item.unitId ?? `level-${item.level ?? 1}`)));
  if (selectedUnit) collapsedLevels.delete(String(selectedUnit));
  let adding = false;
  let batchOpen = false;
  let batchText = '';
  let batchPreview = null;
  let duplicateMode = 'merge';
  let wordImportMode = 'merge';
  let unitPage = 0;
  let searchQuery = '';
  let wordLibraryStatus = '';
  let notice = '';

  const graphemeByText = () => Object.fromEntries(content.graphemes.items.map((item) => [item.text, item.id]));
  const currentWord = () => activeWords().find((item) => item.id === selectedWordId) ?? null;
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
    const revisionRecord = await adapter.get('meta', 'contentRevision');
    const revision = Number(revisionRecord?.value ?? 0) + 1;
    await adapter.transaction(['words', 'graphemes', 'sentences', 'confusables', 'meta'], async (tx) => {
      for (const store of ['words', 'graphemes', 'sentences', 'confusables']) {
        for (const item of content[store].items) await tx.put(store, item);
      }
      await tx.put('meta', { key: 'contentVersion', value: CONTENT_VERSION });
      await tx.put('meta', { key: 'contentRevision', value: revision });
    });
    saved = cloneContent(content);
    if (typeof BroadcastChannel === 'function') {
      const channel = new BroadcastChannel('spellwell-content');
      channel.postMessage({ type: 'content-updated', revision });
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
    const unitGroups = new Map();
    for (const item of activeWords()) {
      const key = String(item.unitId ?? `level-${item.level ?? 1}`);
      if (!unitGroups.has(key)) {
        unitGroups.set(key, {
          id: key,
          label: String(item.unitLabel ?? `Level ${item.level ?? 1}`),
          items: [],
        });
      }
      unitGroups.get(key).items.push(item);
    }
    const allUnits = [...unitGroups.values()].sort((a, b) => a.id.localeCompare(b.id));
    const pageSize = 12;
    const pageCount = Math.max(1, Math.ceil(allUnits.length / pageSize));
    if (unitPage >= pageCount) unitPage = pageCount - 1;
    if (unitPage < 0) unitPage = 0;
    const matchingUnits = searchQuery
      ? allUnits.filter((unit) => unit.label.toLowerCase().includes(searchQuery)
        || unit.items.some((item) => `${item.text} ${item.translation ?? ''}`.toLowerCase().includes(searchQuery)))
      : allUnits;
    const units = searchQuery
      ? matchingUnits
      : allUnits.slice(unitPage * pageSize, (unitPage + 1) * pageSize);
    const wordItems = units.map((unit) => {
      const items = unit.items;
      const open = Boolean(searchQuery) || !collapsedLevels.has(unit.id)
        || items.some((item) => item.id === selectedWordId);
      return `
        <details class="sw-admin__level-group" data-level-group="${escape(unit.id)}" ${open ? 'open' : ''}>
          <summary>
            <span>${escape(unit.label)}</span>
            <strong>${items.length}</strong>
            ${learningService ? `<select class="sw-admin__learning-select" data-unit-learning="${escape(unit.id)}" aria-label="Unit learning status" title="学习状态（立即生效）">${learningOptions(deriveUnitStatus(items, learningStates), `unit-${unit.id}`)}</select>` : ''}
          </summary>
          <ul class="sw-admin__word-list">
            ${items.map((item) => {
              const active = item.id === selectedWordId;
              const wordDirty = isDirty(item);
              const translation = item.translation ? ` · ${escape(item.translation)}` : '';
              const stats = attemptStats[item.id] ?? { wrong: 0, correct: 0 };
              return `
                <li>
                  <button type="button" class="sw-admin__word-item ${active ? 'is-active' : ''}" data-select-word="${escape(item.id)}">
                    <span class="sw-admin__word-text">${escape(item.text)}${translation}</span>
                    <span class="sw-admin__word-stats">错 <strong>${stats.wrong}</strong> / 对 <strong>${stats.correct}</strong>${wordDirty ? ' · 未保存' : ''}</span>
                  </button>
                </li>
              `;
            }).join('')}
          </ul>
        </details>
      `;
    }).join('');


    let batchPreviewHtml = '';
    let batchActions = [];
    if (batchPreview) {
      const existingTexts = new Set(activeWords().map((item) => item.text));
      const seen = new Set();
      batchActions = batchPreview.entries.map((entry) => {
        const duplicate = existingTexts.has(entry.text) || seen.has(entry.text);
        seen.add(entry.text);
        return { entry, action: duplicate ? duplicateMode : 'created' };
      });
      const created = batchActions.filter((item) => item.action === 'created').length;
      const merged = batchActions.filter((item) => item.action === 'merge').length;
      const replaced = batchActions.filter((item) => item.action === 'replace').length;
      const skipped = batchActions.filter((item) => item.action === 'skip').length;
      const label = { created: '新增', merge: '合并', replace: '替换', skip: '跳过' };
      const rows = batchActions.map(({ entry, action }) => `
        <tr class="${action === 'skip' ? 'is-muted' : ''}">
          <td><strong>${escape(entry.text)}</strong></td>
          <td>${escape(entry.unitLabel || '默认单元')}</td>
          <td>${entry.units.map((unit) => escape(unit.text)).join(' · ')}</td>
          <td>${escape(entry.translation || '—')}</td>
          <td>${escape(entry.phonetic || '—')}</td>
          <td>${label[action]}</td>
        </tr>
      `).join('');
      const errors = batchPreview.errors.map((error) => `<li>第 ${error.line} 行：${escape(error.message)}</li>`).join('');
      batchPreviewHtml = `
        <div class="sw-admin__batch-preview">
          <p>新增 ${created} · 合并 ${merged} · 替换 ${replaced} · 跳过 ${skipped} · 错误 ${batchPreview.errors.length}</p>
          <label class="sw-admin__inline-field">重复词
            <select data-duplicate-mode>
              <option value="merge" ${duplicateMode === 'merge' ? 'selected' : ''}>合并（保留人工切分，只补空字段）</option>
              <option value="replace" ${duplicateMode === 'replace' ? 'selected' : ''}>替换（覆盖切分/中文/音标）</option>
              <option value="skip" ${duplicateMode === 'skip' ? 'selected' : ''}>跳过</option>
            </select>
          </label>
          ${rows ? `<table class="sw-admin__units"><thead><tr><th>词</th><th>单元</th><th>切分</th><th>中文</th><th>音标</th><th>处理</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
          ${errors ? `<ul class="sw-admin__errors">${errors}</ul>` : ''}
          <button type="button" class="sw-check" data-batch-commit ${created + merged + replaced === 0 ? 'disabled' : ''}>加入并保存</button>
        </div>
      `;
    }

    root.innerHTML = `
      <section class="sw-panel sw-admin__overview">
        <div>
          <h2>内容概览</h2>
          <p class="sw-admin__muted">${escape(textbookLabel(activeTextbook))} · words ${activeWords().length} · graphemes ${content.graphemes.items.length} · sentences ${content.sentences.items.length} · confusables ${content.confusables.items.length}</p>
        </div>
        <div class="sw-admin__overview-actions">
          <label class="sw-admin__inline-field">教材版本
            <select data-textbook-select>
              ${TEXTBOOKS.map((book) => `<option value="${escape(book.id)}" ${activeTextbook === book.id ? 'selected' : ''}>${escape(book.label)}</option>`).join('')}
            </select>
          </label>
          <a class="sw-text-button" href="/admin/settings.html">练习设置</a>
          <a class="sw-text-button" href="/migration/index.html">本机数据迁移</a>
          <span class="sw-admin__badge ${report.valid ? 'is-ok' : 'is-bad'}">${report.valid ? 'V1—V9 通过' : `${report.errors.length} 个问题`}</span>
        </div>
      </section>

      <section class="sw-panel sw-admin__batch ${batchOpen ? 'is-open' : ''}">
        <div class="sw-admin__batch-head">
          <div>
            <h2>批量新增</h2>
            <p class="sw-admin__muted">先写单元标题行（如 <code>一年级上unit2</code>），后续单词归入该单元，直到下一个标题；每行一个词，逗号显式切分，无逗号自动切分；可追加中文/音标。</p>
          </div>
          <button type="button" class="sw-text-button" data-toggle-batch>${batchOpen ? '收起' : '展开'}</button>
        </div>
        ${batchOpen ? `
          <textarea data-batch-input rows="6" spellcheck="false" placeholder="一年级上unit2\nw,ea,th,er | 天气 | /ˈweðər/\nfish\n二年级下unit5\nboat">${escape(batchText)}</textarea>
          <div class="sw-admin__toolbar">
            <button type="button" class="sw-text-button" data-batch-preview>解析预览</button>
            <span class="sw-admin__muted">单元标题行切换后续词所属单元；中文/音标可留空；“|”分隔词、中文、音标。</span>
          </div>
          ${batchPreviewHtml}
        ` : ''}
      </section>

      <section class="sw-panel sw-admin__library">
        <div class="sw-admin__batch-head">
          <div>
            <h2>词库导入 / 导出</h2>
            <p class="sw-admin__muted">只导入/导出 words，不含学习状态；重复词按下方方式处理。</p>
          </div>
          <button type="button" class="sw-text-button" data-export-words>导出词库 JSON</button>
        </div>
        <div class="sw-admin__toolbar">
          <label class="sw-admin__inline-field">重复词
            <select data-word-import-mode>
              <option value="merge" ${wordImportMode === 'merge' ? 'selected' : ''}>合并（保留已有切分，补空字段）</option>
              <option value="replace" ${wordImportMode === 'replace' ? 'selected' : ''}>替换（覆盖切分/中文/音标/单元）</option>
              <option value="skip" ${wordImportMode === 'skip' ? 'selected' : ''}>不动（跳过）</option>
            </select>
          </label>
          <label class="sw-text-button sw-admin__file-button">选择词库文件
            <input type="file" accept="application/json,.json" data-import-words />
          </label>
        </div>
        ${wordLibraryStatus ? `<p class="sw-admin__notice">${escape(wordLibraryStatus)}</p>` : ''}
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
          ${wordItems || '<p class="sw-admin__muted">没有单词</p>'}
          ${searchQuery ? '' : `
            <nav class="sw-admin__pager" aria-label="Unit pages">
              <button type="button" class="sw-text-button" data-page-prev ${unitPage === 0 ? 'disabled' : ''}>上一页</button>
              <span>${unitPage + 1} / ${pageCount}</span>
              <button type="button" class="sw-text-button" data-page-next ${unitPage >= pageCount - 1 ? 'disabled' : ''}>下一页</button>
            </nav>
          `}
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
              <label>年级
                <select data-word-grade>
                  ${[1, 2, 3, 4, 5, 6].map((grade) => `<option value="${grade}" ${word.grade === grade ? 'selected' : ''}>${['一', '二', '三', '四', '五', '六'][grade - 1]}年级</option>`).join('')}
                </select>
              </label>
              <label>学期
                <select data-word-term>
                  <option value="上" ${word.term === '上' ? 'selected' : ''}>上</option>
                  <option value="下" ${word.term === '下' ? 'selected' : ''}>下</option>
                </select>
              </label>
              <label>单元 <input type="number" min="1" max="20" data-word-unit value="${word.unit ?? 1}" /></label>
              <label>中文 <input data-word-translation value="${escape(word.translation ?? '')}" placeholder="可选" /></label>
              <label>音标 <input data-word-phonetic value="${escape(word.phonetic ?? '')}" placeholder="可选，如 /ˈweðər/" /></label>
              <label>Review
                <select data-word-review>
                  ${['unreviewed', 'reviewed', 'retired'].map((status) => `<option value="${status}" ${word.reviewStatus === status ? 'selected' : ''}>${status}</option>`).join('')}
                </select>
              </label>
              ${learningService ? `
                <label>学习状态（立即生效）
                  <select data-word-learning>
                    ${learningOptions(learningStates.get(String(word.id))?.status ?? 'unstarted', `word-${word.id}`)}
                  </select>
                </label>
              ` : ''}
            </div>
            <p class="sw-admin__muted">学习状态只改调度，不删除历史答题记录；未开始可重新进入新词。</p>

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
    if (search) {
      search.value = searchQuery;
      if (searchQuery) {
        search.focus();
        search.setSelectionRange(search.value.length, search.value.length);
      }
      search.addEventListener('input', () => {
        searchQuery = search.value.trim().toLowerCase();
        unitPage = 0;
        render();
      });
    }
    root.querySelector('[data-page-prev]')?.addEventListener('click', () => {
      unitPage = Math.max(0, unitPage - 1);
      render();
    });
    root.querySelector('[data-page-next]')?.addEventListener('click', () => {
      unitPage += 1;
      render();
    });

    for (const select of root.querySelectorAll('[data-unit-learning]')) {
      select.addEventListener('click', (event) => event.stopPropagation());
      select.addEventListener('change', async () => {
        if (!learningService || !select.value) return;
        const unit = allUnits.find((item) => item.id === select.dataset.unitLearning);
        if (!unit) return;
        const status = select.value;
        const label = learningLabel(status);
        if (!window.confirm(`将「${unit.label}」的 ${unit.items.length} 个单词设为「${label}」？\n只改学习状态，不删除历史答题记录。`)) {
          render();
          return;
        }
        try {
          const states = await learningService.setUnitStatus(unit.items, status);
          for (const state of states) learningStates.set(String(state.wordId), state);
          notice = `已将「${unit.label}」设为「${label}」。`;
        } catch (error) {
          notice = `学习状态保存失败：${String(error.message ?? error)}`;
        }
        render();
      });
    }
    const wordLearning = root.querySelector('[data-word-learning]');
    if (wordLearning && word) {
      wordLearning.addEventListener('change', async () => {
        if (!learningService || !wordLearning.value) return;
        const status = wordLearning.value;
        try {
          const state = await learningService.setWordStatus(word.id, status);
          learningStates.set(String(state.wordId), state);
          notice = `已将 ${word.text} 设为「${learningLabel(status)}」。`;
        } catch (error) {
          notice = `学习状态保存失败：${String(error.message ?? error)}`;
        }
        render();
      });
    }

    for (const details of root.querySelectorAll('[data-level-group]')) {
      details.addEventListener('toggle', () => {
        const level = details.dataset.levelGroup;
        if (details.open) collapsedLevels.delete(level);
        else collapsedLevels.add(level);
      });
    }
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
    root.querySelector('[data-duplicate-mode]')?.addEventListener('change', (event) => {
      duplicateMode = event.target.value;
      render();
    });
    root.querySelector('[data-textbook-select]')?.addEventListener('change', async (event) => {
      activeTextbook = event.target.value;
      searchQuery = '';
      unitPage = 0;
      if (adapter) await saveActiveTextbook(adapter, activeTextbook);
      selectedWordId = activeWords()[0]?.id ?? null;
      collapsedLevels.clear();
      for (const word of activeWords()) {
        collapsedLevels.add(String(word.unitId ?? `level-${word.level ?? 1}`));
      }
      const selectedUnitId = activeWords().find((word) => word.id === selectedWordId)?.unitId;
      if (selectedUnitId) collapsedLevels.delete(String(selectedUnitId));
      notice = `已切换到 ${textbookLabel(activeTextbook)}。`;
      render();
    });
    root.querySelector('[data-word-import-mode]')?.addEventListener('change', (event) => {
      wordImportMode = event.target.value;
      render();
    });
    root.querySelector('[data-export-words]')?.addEventListener('click', () => {
      const library = buildWordLibrary(activeWords());
      const blob = new Blob([JSON.stringify(library, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `spellwell-words-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      wordLibraryStatus = `已导出 ${library.items.length} 个词。`;
      render();
    });
    root.querySelector('[data-import-words]')?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const parsed = parseWordLibrary(await file.text());
      if (parsed.errors.length > 0) {
        wordLibraryStatus = `导入失败：${parsed.errors.slice(0, 3).join('；')}`;
        render();
        return;
      }
      const before = cloneContent(content);
      try {
        const counts = applyWordLibrary(content, parsed.items, wordImportMode, activeTextbook);
        const report = validateContent(content);
        if (!report.valid || counts.errors.length > 0) {
          content = before;
          const details = counts.errors.slice(0, 3).map((item) => `${item.text || '?'}: ${item.message}`).join('；');
          wordLibraryStatus = `导入失败${details ? `：${details}` : ''}（${report.errors.length} 个校验问题）`;
          render();
          return;
        }
        const ok = await persistContent();
        wordLibraryStatus = ok
          ? `导入完成：新增 ${counts.created} · 合并 ${counts.merged} · 替换 ${counts.replaced} · 不动 ${counts.skipped}。`
          : '导入已生成草稿，但校验未通过，未写入本机数据库。';
      } catch (error) {
        content = before;
        wordLibraryStatus = `导入失败：${String(error.message ?? error)}`;
      }
      render();
    });
    root.querySelector('[data-batch-commit]')?.addEventListener('click', async () => {
      if (!batchPreview || batchActions.length === 0) return;
      const counts = { created: 0, merged: 0, replaced: 0, skipped: 0 };
      for (const { entry } of batchActions) {
        const baseUnit = currentWord();
        const result = importWord(content, {
          ...entry,
          grade: entry.grade ?? baseUnit?.grade ?? 1,
          term: entry.term ?? baseUnit?.term ?? '下',
          unit: entry.unit ?? baseUnit?.unit ?? 1,
          unitId: entry.unitId ?? baseUnit?.unitId ?? 'g1-s2-u1',
          unitLabel: entry.unitLabel ?? baseUnit?.unitLabel ?? '一年级下 · 第1单元',
          textbook: activeTextbook,
          textbookLabel: textbookLabel(activeTextbook),
        }, duplicateMode);
        counts[result === 'created' ? 'created' : result === 'merged' ? 'merged' : result === 'replaced' ? 'replaced' : 'skipped'] += 1;
      }
      const changed = counts.created + counts.merged + counts.replaced;
      const lastText = [...batchActions].reverse().find((item) => item.action !== 'skip')?.entry.text;
      if (lastText) selectedWordId = activeWords().find((item) => item.text === lastText)?.id ?? selectedWordId;
      batchOpen = false;
      batchPreview = null;
      batchText = '';
      const ok = await persistContent();
      notice = ok
        ? `已保存：新增 ${counts.created} · 合并 ${counts.merged} · 替换 ${counts.replaced} · 跳过 ${counts.skipped}。`
        : '已修改草稿，但校验未通过，尚未写入本机数据库。';
      render();
    });

    root.querySelector('[data-add-word]')?.addEventListener('click', () => { adding = true; render(); root.querySelector('[data-add-form] input')?.focus(); });
    root.querySelector('[data-cancel-add]')?.addEventListener('click', () => { adding = false; render(); });
    root.querySelector('[data-add-form]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = String(new FormData(event.currentTarget).get('text') ?? '').trim().toLowerCase();
      if (!/^[a-z]+$/.test(text)) { notice = '新单词只接受小写字母。'; render(); return; }
      const baseUnit = currentWord();
      const created = addWord(content, {
        id: nextWordId(content, text),
        text,
        translation: '',
        phonetic: '',
        grade: baseUnit?.grade ?? 1,
        term: baseUnit?.term ?? '下',
        unit: baseUnit?.unit ?? 1,
        unitId: baseUnit?.unitId ?? 'g1-s2-u1',
        unitLabel: baseUnit?.unitLabel ?? '一年级下 · 第1单元',
        units: [],
        textbook: activeTextbook,
        textbookLabel: textbookLabel(activeTextbook),
        reviewStatus: 'unreviewed',
      });
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
        selectedWordId = activeWords()[0]?.id ?? null;
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
        const grade = Number(root.querySelector('[data-word-grade]').value);
        const term = root.querySelector('[data-word-term]').value;
        const unit = Number(root.querySelector('[data-word-unit]').value);
        const unitId = `g${grade}-s${term === '下' ? '2' : '1'}-u${unit}`;
        const unitLabel = `${['一', '二', '三', '四', '五', '六'][grade - 1]}年级${term} · 第${unit}单元`;
        updateWord(content, word.id, {
          text,
          grade,
          term,
          unit,
          unitId,
          unitLabel,
          translation,
          phonetic,
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
