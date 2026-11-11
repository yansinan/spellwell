/**
 * @layer tests
 * @phase P9
 * @doc §5.3 存储层平移策略
 */

import { MemoryAdapter } from '../../src/storage/MemoryAdapter.js';
import {
  DEFAULT_PRACTICE_SETTINGS,
  normalizePracticeSettings,
  readPracticeSettings,
  savePracticeSettings,
} from '../../src/storage/practiceSettings.js';
import { assertDeepEqual, assertEqual, assertRejects, test } from '../harness.js';

test('练习设置：默认 20 题，范围 5—30', () => {
  assertEqual(DEFAULT_PRACTICE_SETTINGS.questionsPerPractice, 20);
  assertEqual(normalizePracticeSettings({}).questionsPerPractice, 20);
  assertEqual(normalizePracticeSettings({ questionsPerPractice: 5 }).questionsPerPractice, 5);
  assertEqual(normalizePracticeSettings({ questionsPerPractice: 30 }).questionsPerPractice, 30);
  assertRejects(() => normalizePracticeSettings({ questionsPerPractice: 4 }), 'PRACTICE_SETTINGS_INVALID');
  assertRejects(() => normalizePracticeSettings({ questionsPerPractice: 31 }), 'PRACTICE_SETTINGS_INVALID');
});

test('练习设置：存 meta，重新读取一致', async () => {
  const adapter = new MemoryAdapter();
  await adapter.init();
  await savePracticeSettings(adapter, { questionsPerPractice: 20, defaultMode: 'effort' });
  assertDeepEqual(await readPracticeSettings(adapter), { questionsPerPractice: 20, defaultMode: 'effort' });
});
