/**
 * @layer storage
 * @phase P9
 * @doc §5.3 存储层平移策略
 *
 * 练习设置存于 meta；前台不选题量，由后台决定。
 */

import { ContractError } from '../core/errors.js';

export const PRACTICE_SETTINGS_KEY = 'practiceSettings';
export const MIN_PRACTICE_QUESTIONS = 5;
export const MAX_PRACTICE_QUESTIONS = 30;
export const DEFAULT_PRACTICE_SETTINGS = Object.freeze({
  questionsPerPractice: 20,
  defaultMode: 'review',
});

/**
 * @param {unknown} value
 * @returns {{questionsPerPractice: number, defaultMode: 'review'|'effort'}}
 */
export function normalizePracticeSettings(value) {
  const input = value && typeof value === 'object' ? value : {};
  const questionsPerPractice = input.questionsPerPractice ?? DEFAULT_PRACTICE_SETTINGS.questionsPerPractice;
  if (!Number.isInteger(questionsPerPractice)
    || questionsPerPractice < MIN_PRACTICE_QUESTIONS
    || questionsPerPractice > MAX_PRACTICE_QUESTIONS) {
    throw new ContractError(
      'PRACTICE_SETTINGS_INVALID',
      `questionsPerPractice must be ${MIN_PRACTICE_QUESTIONS}..${MAX_PRACTICE_QUESTIONS}`,
    );
  }
  const defaultMode = input.defaultMode ?? DEFAULT_PRACTICE_SETTINGS.defaultMode;
  if (defaultMode !== 'review' && defaultMode !== 'effort') {
    throw new ContractError('PRACTICE_SETTINGS_INVALID', 'defaultMode must be review or effort');
  }
  return { questionsPerPractice, defaultMode };
}

/**
 * @param {import('./StorageAdapter.js').StorageAdapter} adapter
 */
export async function readPracticeSettings(adapter) {
  const record = await adapter.get('meta', PRACTICE_SETTINGS_KEY);
  if (!record) return { ...DEFAULT_PRACTICE_SETTINGS };
  return normalizePracticeSettings(record.value);
}

/**
 * @param {import('./StorageAdapter.js').StorageAdapter} adapter
 * @param {{questionsPerPractice: number, defaultMode: 'review'|'effort'}} settings
 */
export async function savePracticeSettings(adapter, settings) {
  const normalized = normalizePracticeSettings(settings);
  await adapter.put('meta', { key: PRACTICE_SETTINGS_KEY, value: normalized });
  return normalized;
}
