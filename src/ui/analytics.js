/**
 * @layer ui
 * @phase P8
 * @doc §2.1 孩子端（学习模块）/ §2.2 家长端
 *
 * 纯统计：本次练习、历史 attempts、按日聚合、状态分布。
 * 不读库、不渲染；UI 只展示结果。
 */

import { toDayKey } from '../core/time.js';

/**
 * @param {number} correct
 * @param {number} total
 * @returns {number}
 */
function percent(correct, total) {
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}

/**
 * @param {import('../core/contracts.js').AttemptResult[]} results
 */
export function summarizeSession(results) {
  const list = Array.isArray(results) ? results : [];
  const correct = list.filter((result) => result.wordCorrect).length;
  const errors = {};
  for (const result of list) {
    if (!result.wordCorrect && result.firstError?.type) {
      errors[result.firstError.type] = (errors[result.firstError.type] ?? 0) + 1;
    }
  }
  const topError = Object.entries(errors).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    total: list.length,
    correct,
    wrong: list.length - correct,
    accuracy: percent(correct, list.length),
    errors,
    topError,
  };
}

/**
 * @param {Record<string, any>[]} attempts
 */
export function summarizeAttempts(attempts) {
  const list = Array.isArray(attempts) ? attempts : [];
  const correct = list.filter((attempt) => attempt.wordCorrect).length;
  const errors = {};
  const byWord = {};
  for (const attempt of list) {
    const wordId = String(attempt.wordId ?? '');
    if (!byWord[wordId]) byWord[wordId] = { wordId, total: 0, correct: 0 };
    byWord[wordId].total += 1;
    if (attempt.wordCorrect) byWord[wordId].correct += 1;
    else if (attempt.firstError?.type) {
      errors[attempt.firstError.type] = (errors[attempt.firstError.type] ?? 0) + 1;
    }
  }
  const topError = Object.entries(errors).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    total: list.length,
    correct,
    wrong: list.length - correct,
    accuracy: percent(correct, list.length),
    errors,
    topError,
    byWord,
  };
}

/**
 * @param {Record<string, any>[]} attempts
 * @returns {{date: string, total: number, correct: number, accuracy: number}[]}
 */
export function groupAttemptsByDay(attempts) {
  const map = new Map();
  for (const attempt of Array.isArray(attempts) ? attempts : []) {
    if (!Number.isFinite(attempt.timestamp)) continue;
    const date = toDayKey(new Date(attempt.timestamp));
    if (!map.has(date)) map.set(date, { date, total: 0, correct: 0 });
    const day = map.get(date);
    day.total += 1;
    if (attempt.wordCorrect) day.correct += 1;
  }
  return [...map.values()]
    .map((day) => ({ ...day, accuracy: percent(day.correct, day.total) }))
    .sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
}

/**
 * @param {Record<string, any>[]} states
 */
export function summarizeWordStates(states) {
  const counts = { learning: 0, reviewing: 0, probe: 0, mastered: 0 };
  for (const state of Array.isArray(states) ? states : []) {
    if (counts[state.status] !== undefined) counts[state.status] += 1;
  }
  return counts;
}

/**
 * @param {{attempts?: Record<string, any>[], wordStates?: Record<string, any>[], graphemeStates?: Record<string, any>[]}} input
 */
export function buildReport({ attempts = [], wordStates = [], graphemeStates = [] } = {}) {
  const recent = [...attempts]
    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
    .slice(0, 30);
  return {
    attempts: summarizeAttempts(attempts),
    days: groupAttemptsByDay(attempts),
    states: summarizeWordStates(wordStates),
    graphemeProbe: graphemeStates.filter((state) => state.status === 'probe').length,
    recent,
  };
}
