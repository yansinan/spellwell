/**
 * @layer admin
 * @phase P12
 * @doc §2.3 内容后台
 *
 * 家长端只读做题分析：练习场次、趋势、薄弱词、错误类型、到期复习量。
 * 不写 attempts / wordStates / graphemeStates。
 */

import { toDayKey } from '../core/time.js';

const SESSION_GAP_MS = 30 * 60 * 1000;
const DAYS = 14;

const ERROR_LABELS = Object.freeze({
  OMISSION: '漏写',
  SUBSTITUTION: '替换',
  INSERTION: '多加',
  TRANSPOSITION: '顺序',
  SEGMENTATION: '切分',
  DOUBLING: '重复',
  VOWEL: '元音',
  CONSONANT: '辅音',
  OTHER: '其他',
});

const STATUS_LABELS = Object.freeze({
  learning: '学习中',
  reviewing: '复习中',
  probe: '抽查中',
  mastered: '已掌握',
  unstarted: '未开始',
});

function percent(correct, total) {
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}

function dayFromTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? toDayKey(new Date(timestamp)) : null;
}

function formatDateTime(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return '—';
  return new Date(timestamp).toLocaleString();
}

function formatDuration(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${String(rest).padStart(2, '0')}s`;
}

/**
 * 以 30 分钟间隔估算练习场次（attempts 没有 sessionId）。
 * @param {Record<string, any>[]} attempts
 * @param {number} [gapMs]
 */
export function groupPracticeSessions(attempts, gapMs = SESSION_GAP_MS) {
  const sorted = (Array.isArray(attempts) ? attempts : [])
    .filter((attempt) => Number.isFinite(Number(attempt.timestamp)))
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  const sessions = [];
  let current = null;
  for (const attempt of sorted) {
    const at = Number(attempt.timestamp);
    if (!current || at - current.endedAt > gapMs) {
      current = {
        startedAt: at,
        endedAt: at,
        total: 0,
        correct: 0,
        wrong: 0,
        errors: {},
        wrongAttempts: [],
        wordIds: new Set(),
      };
      sessions.push(current);
    }
    current.endedAt = at;
    current.total += 1;
    if (attempt.wordCorrect) current.correct += 1;
    else {
      current.wrong += 1;
      current.wrongAttempts.push(attempt);
      const type = attempt.firstError?.type;
      if (type) current.errors[type] = (current.errors[type] ?? 0) + 1;
    }
    if (attempt.wordId) current.wordIds.add(String(attempt.wordId));
  }
  return sessions.map((session, index) => ({
    index,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    total: session.total,
    correct: session.correct,
    wrong: session.wrong,
    accuracy: percent(session.correct, session.total),
    durationMs: Math.max(0, session.endedAt - session.startedAt),
    wordCount: session.wordIds.size,
    errors: session.errors,
    wrongAttempts: session.wrongAttempts,
  })).sort((a, b) => b.startedAt - a.startedAt);
}

function buildDailyTrend(attempts, now) {
  const map = new Map();
  for (const attempt of attempts) {
    const date = dayFromTimestamp(attempt.timestamp);
    if (!date) continue;
    if (!map.has(date)) map.set(date, { date, total: 0, correct: 0 });
    const day = map.get(date);
    day.total += 1;
    if (attempt.wordCorrect) day.correct += 1;
  }
  const result = [];
  const today = new Date(now);
  for (let offset = DAYS - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = toDayKey(date);
    const day = map.get(key) ?? { date: key, total: 0, correct: 0 };
    result.push({ ...day, accuracy: day.total > 0 ? percent(day.correct, day.total) : null });
  }
  return result;
}

function buildFocusWords(attempts, wordsById, statesById) {
  const byWord = new Map();
  for (const attempt of attempts) {
    const wordId = String(attempt.wordId ?? '');
    if (!wordId) continue;
    if (!byWord.has(wordId)) {
      byWord.set(wordId, { wordId, total: 0, correct: 0, wrong: 0, lastAt: 0, errors: {} });
    }
    const entry = byWord.get(wordId);
    entry.total += 1;
    entry.lastAt = Math.max(entry.lastAt, Number(attempt.timestamp) || 0);
    if (attempt.wordCorrect) entry.correct += 1;
    else {
      entry.wrong += 1;
      const type = attempt.firstError?.type;
      if (type) entry.errors[type] = (entry.errors[type] ?? 0) + 1;
    }
  }
  return [...byWord.values()]
    .filter((entry) => entry.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong || b.lastAt - a.lastAt)
    .slice(0, 8)
    .map((entry) => {
      const word = wordsById.get(entry.wordId);
      const state = statesById.get(entry.wordId);
      return {
        ...entry,
        text: String(word?.text ?? entry.wordId.replace(/^w\./, '')),
        translation: String(word?.translation ?? ''),
        accuracy: percent(entry.correct, entry.total),
        status: state?.status ?? 'unstarted',
        dueDate: state?.dueDate ?? null,
        topError: Object.entries(entry.errors).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      };
    });
}

/**
 * @param {{
 *   attempts?: Record<string, any>[],
 *   states?: Record<string, any>[],
 *   wordStates?: Record<string, any>[],
 *   words?: Record<string, any>[],
 *   now?: number,
 *   sessionGapMs?: number
 * }} input
 */
export function buildHistoryAnalytics({
  attempts = [],
  states = [],
  wordStates = [],
  words = [],
  now = Date.now(),
  sessionGapMs = SESSION_GAP_MS,
} = {}) {
  const list = Array.isArray(attempts) ? attempts : [];
  const stateList = Array.isArray(states) && states.length > 0 ? states : (Array.isArray(wordStates) ? wordStates : []);
  const rawSessions = groupPracticeSessions(list, sessionGapMs);
  const daily = buildDailyTrend(list, now);
  const total = list.length;
  const correct = list.filter((attempt) => attempt.wordCorrect).length;
  const wordsById = new Map((Array.isArray(words) ? words : []).map((word) => [String(word.id), word]));
  const statesById = new Map(stateList.map((state) => [String(state.wordId), state]));
  const sessions = rawSessions.map((session) => ({
    ...session,
    errorDetails: session.wrongAttempts.map((attempt) => {
      const word = wordsById.get(String(attempt.wordId));
      const error = attempt.firstError ?? {};
      return {
        wordId: String(attempt.wordId ?? ''),
        word: String(word?.text ?? String(attempt.wordId ?? '').replace(/^w\./, '')),
        translation: String(word?.translation ?? ''),
        timestamp: Number(attempt.timestamp),
        type: error.type ?? null,
        label: ERROR_LABELS[error.type] ?? error.type ?? '错误',
        unitKind: error.unitKind ?? null,
        unitId: error.unitId ?? null,
        position: Number.isFinite(Number(error.position)) ? Number(error.position) : null,
        expected: error.expected ?? '',
        actual: error.actual ?? '',
      };
    }).sort((a, b) => a.timestamp - b.timestamp),
  }));
  const focusWords = buildFocusWords(list, wordsById, statesById);
  const errorTypes = {};
  for (const attempt of list) {
    if (attempt.wordCorrect) continue;
    const type = attempt.firstError?.type;
    if (type) errorTypes[type] = (errorTypes[type] ?? 0) + 1;
  }
  const statusCounts = { learning: 0, reviewing: 0, probe: 0, mastered: 0 };
  for (const state of statesById.values()) {
    if (statusCounts[state.status] !== undefined) statusCounts[state.status] += 1;
  }
  const today = toDayKey(new Date(now));
  const dueWords = [...statesById.values()]
    .filter((state) => state.status !== 'mastered' && state.status !== 'unstarted' && state.dueDate && String(state.dueDate) <= today)
    .map((state) => ({
      ...state,
      text: String(wordsById.get(String(state.wordId))?.text ?? String(state.wordId).replace(/^w\./, '')),
    }))
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  const latest = sessions[0] ?? null;
  const previous = sessions[1] ?? null;
  const days = new Set(list.map((attempt) => dayFromTimestamp(attempt.timestamp)).filter(Boolean));
  return {
    summary: {
      total,
      correct,
      wrong: total - correct,
      accuracy: percent(correct, total),
      days: days.size,
      latestAccuracy: latest?.accuracy ?? null,
      accuracyDelta: latest && previous ? latest.accuracy - previous.accuracy : null,
      sessions: sessions.length,
    },
    sessions: sessions.slice(0, 8),
    daily,
    focusWords,
    errorTypes: Object.entries(errorTypes)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count, label: ERROR_LABELS[type] ?? type })),
    statusCounts,
    dueWords,
    dueCount: dueWords.length,
    hasData: total > 0,
  };
}

function escape(value) {
  return String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/**
 * @param {ReturnType<typeof buildHistoryAnalytics>} data
 */
export function renderHistoryAnalytics(data) {
  if (!data.hasData) {
    return `
      <section class="sw-panel sw-admin__analytics">
        <h2>做题分析</h2>
        <p class="sw-admin__muted">还没有做题记录。完成一轮练习后，这里会显示正确率变化、薄弱词和重点复习建议。</p>
      </section>
    `;
  }
  const chartMax = Math.max(1, ...data.daily.map((day) => day.total));
  const chart = data.daily.map((day) => {
    const height = day.total === 0 ? 4 : Math.max(8, Math.round((day.total / chartMax) * 100));
    const label = day.date.slice(5);
    return `
      <div class="sw-analytics__bar" title="${escape(day.date)} · ${day.total} 题${day.accuracy === null ? '' : ` · ${day.accuracy}%`}">
        <span style="height:${height}%"></span>
        <small>${escape(label)}</small>
      </div>
    `;
  }).join('');
  const delta = data.summary.accuracyDelta;
  const deltaText = delta === null ? '暂无对比' : `${delta > 0 ? '+' : ''}${delta}%`;
  const sessions = data.sessions.map((session) => {
    const errors = session.errorDetails.length > 0
      ? `<ul class="sw-analytics__session-errors">${session.errorDetails.map((error) => `
          <li>
            <div><strong>${escape(error.word)}</strong>${error.translation ? `<small>${escape(error.translation)}</small>` : ''}</div>
            <span class="sw-analytics__error-type">${escape(error.label)}</span>
            <small>期望 <code>${escape(error.expected || '∅')}</code> · 实际 <code>${escape(error.actual || '∅')}</code>${error.position !== null ? ` · 位置 ${error.position + 1}` : ''}</small>
            <time>${escape(formatDateTime(error.timestamp))}</time>
          </li>
        `).join('')}</ul>`
      : '<p class="sw-admin__muted">本轮没有错误。</p>';
    return `
      <details class="sw-analytics__session">
        <summary>
          <span>${escape(formatDateTime(session.startedAt))}</span>
          <span>${session.total} 题</span>
          <strong>${session.accuracy}%</strong>
          <span>${escape(formatDuration(session.durationMs))}</span>
          <span>${session.wordCount} 词</span>
          <span class="sw-analytics__chevron" aria-hidden="true">›</span>
        </summary>
        <div class="sw-analytics__session-detail">
          <h4>错误详情</h4>
          ${errors}
        </div>
      </details>
    `;
  }).join('');
  const focus = data.focusWords.map((word) => `
    <li>
      <div>
        <strong>${escape(word.text)}</strong>
        ${word.translation ? `<small>${escape(word.translation)}</small>` : ''}
      </div>
      <span class="sw-analytics__pill">错 ${word.wrong} / ${word.total}</span>
      <small>${escape(STATUS_LABELS[word.status] ?? word.status)}${word.dueDate ? ` · 到期 ${escape(word.dueDate)}` : ''}${word.topError ? ` · ${escape(ERROR_LABELS[word.topError] ?? word.topError)}` : ''}</small>
    </li>
  `).join('') || '<li class="sw-admin__muted">没有明显薄弱词。</li>';
  const errors = data.errorTypes.map((error) => `<li><span>${escape(error.label)}</span><strong>${error.count}</strong></li>`).join('') || '<li class="sw-admin__muted">没有错误记录。</li>';
  return `
    <section class="sw-panel sw-admin__analytics">
      <div class="sw-admin__batch-head">
        <div>
          <h2>做题分析</h2>
          <p class="sw-admin__muted">按做题时间估算场次（间隔超过 30 分钟视为新一轮），只读统计，不改变学习状态。</p>
        </div>
        <span class="sw-admin__badge is-ok">最近 ${data.daily.filter((day) => day.total > 0).length} 天有练习</span>
      </div>

      <div class="sw-admin__analytics-cards">
        <div><small>累计题数</small><strong>${data.summary.total}</strong></div>
        <div><small>总体正确率</small><strong>${data.summary.accuracy}%</strong></div>
        <div><small>最近一轮</small><strong>${data.summary.latestAccuracy === null ? '—' : `${data.summary.latestAccuracy}%`}</strong><em class="${delta !== null && delta < 0 ? 'is-down' : 'is-up'}">${deltaText}</em></div>
        <div><small>练习天数</small><strong>${data.summary.days}</strong></div>
        <div><small>已掌握</small><strong>${data.statusCounts.mastered}</strong></div>
        <div><small>待复习</small><strong>${data.dueCount}</strong></div>
      </div>

      <div class="sw-admin__analytics-grid">
        <div>
          <h3>最近 14 天题量 / 正确率</h3>
          <div class="sw-admin__chart">${chart}</div>
          <p class="sw-admin__muted">柱高代表当天题量；悬停查看正确率。</p>
        </div>
        <div>
          <h3>重点关注</h3>
          <ul class="sw-admin__focus-list">${focus}</ul>
        </div>
      </div>

      <div class="sw-admin__analytics-grid">
        <div>
          <h3>历次练习</h3>
          <div class="sw-analytics__sessions">${sessions}</div>
        </div>
        <div>
          <h3>错误类型</h3>
          <ul class="sw-admin__analytics-errors">${errors}</ul>
          <h3>当前状态</h3>
          <p class="sw-admin__muted">学习中 ${data.statusCounts.learning} · 复习中 ${data.statusCounts.reviewing} · 抽查中 ${data.statusCounts.probe} · 已掌握 ${data.statusCounts.mastered}</p>
        </div>
      </div>
    </section>
  `;
}
