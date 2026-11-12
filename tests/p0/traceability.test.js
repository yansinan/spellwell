/**
 * @layer tests
 * @phase P0
 * @doc §四、分阶段开发规划
 *
 * 文档守卫：DESIGN 的枚举、TRACEABILITY 的覆盖、ROADMAP 的阶段、
 * ADR 的存在性、token 与零依赖约束，都必须与代码一致。
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ERROR_TYPES } from '../../src/core/contracts.js';
import { QUESTION_TYPE_IDS } from '../../src/questionTypes/registry.js';
import { STORAGE_METHODS } from '../../src/storage/StorageAdapter.js';
import { assert, assertDeepEqual, assertEqual, assertMatch, test } from '../harness.js';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testsDir, '..', '..');

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

const design = await read('docs/DESIGN.md');
const traceability = await read('docs/TRACEABILITY.md');
const roadmap = await read('docs/ROADMAP.md');
const fileSpec = await read('docs/FILE_SPEC.md');
const contentSpec = await read('docs/CONTENT_SPEC.md');
const agents = await read('AGENTS.md');
const changelog = await read('CHANGELOG.md');
const readme = await read('README.md');
const tokens = await read('styles/tokens.css');
const packageJson = JSON.parse(await read('package.json'));
const decisionFiles = await readdir(path.join(root, 'docs', 'decisions'));

test('DESIGN 是唯一需求源：有版本、有定稿标记、覆盖全部枚举', () => {
  assertMatch(design, /版本\*\*：v1\.2/);
  assertMatch(design, /唯一需求源/);
  assertMatch(design, /定稿/);
  for (const typeId of QUESTION_TYPE_IDS) assert(design.includes(typeId), `DESIGN missing ${typeId}`);
  for (const errorType of ERROR_TYPES) assert(design.includes(errorType), `DESIGN missing ${errorType}`);
  for (const method of STORAGE_METHODS) assert(design.includes(method), `DESIGN missing ${method}`);
});

test('TRACEABILITY 覆盖 9 题型、9 错误类型与 7 存储方法', () => {
  for (const typeId of QUESTION_TYPE_IDS) assert(traceability.includes(typeId), `traceability missing ${typeId}`);
  for (const method of STORAGE_METHODS) assert(traceability.includes(method), `traceability missing ${method}`);
  for (const errorType of ERROR_TYPES) {
    assert(
      traceability.includes(errorType) || traceability.includes('全部错误') || traceability.includes('错误类型'),
      `traceability missing ${errorType}`,
    );
  }
  assertMatch(traceability, /R-ARCH-01/);
  assertMatch(traceability, /R-DOC-01/);
  assertMatch(traceability, /--phase=p0/);
});

test('ROADMAP 覆盖 P0—P12，P11 已完成、P12 为下一步', () => {
  for (let index = 0; index <= 12; index += 1) {
    assert(roadmap.includes(`P${index}`), `ROADMAP missing P${index}`);
  }
  assertMatch(roadmap, /P0\*\*.*✅ 完成/s);
  assertMatch(roadmap, /P1\*\*.*✅ 完成/s);
  assertMatch(roadmap, /P12\*\*.*⏳ 下一步/s);
  assertMatch(roadmap, /node tests\/runTests\.js --phase=p0/);
});

test('AGENTS 是执行入口：必读顺序、门禁命令、完成定义都在', () => {
  assertMatch(agents, /docs\/DESIGN\.md/);
  assertMatch(agents, /docs\/TRACEABILITY\.md/);
  assertMatch(agents, /docs\/ROADMAP\.md/);
  assertMatch(agents, /node tests\/runTests\.js --phase=p11/);
  assertMatch(agents, /完成定义/);
  assertMatch(agents, /不新增依赖/);
  assertMatch(agents, /P11 不通过不进入 P12/);
});

test('ADR：偏离设计的裁决已入库，并被追溯矩阵引用', async () => {
  assert(decisionFiles.includes('0001-storage-contract.md'));
  assert(decisionFiles.includes('0002-docs-as-code.md'));
  assert(decisionFiles.includes('0003-p1-runtime-boundaries.md'));
  assert(decisionFiles.includes('0004-unit-granularity.md'));
  assert(decisionFiles.includes('0005-interaction-feedback.md'));
  assert(decisionFiles.includes('0006-difficulty-gradient.md'));
  assert(decisionFiles.includes('0007-ordered-reorder.md'));
  assert(decisionFiles.includes('0008-indexeddb-content.md'));
  assert(decisionFiles.includes('0009-daily-queue-state.md'));
  assert(decisionFiles.includes('0010-p4-repair-types.md'));
  assert(decisionFiles.includes('0011-grapheme-strengthening.md'));
  assert(decisionFiles.includes('0012-probe-judge-cloze.md'));
  assert(decisionFiles.includes('0013-content-admin-export.md'));
  assert(decisionFiles.includes('0014-learning-analytics.md'));
  assert(decisionFiles.includes('0015-shared-content-migration.md'));
  assert(decisionFiles.includes('0016-auto-segmentation-batch.md'));
  assert(decisionFiles.includes('0017-admin-list-stats-levels.md'));
  assert(decisionFiles.includes('0018-content-driven-practice.md'));
  assert(decisionFiles.includes('0019-attempt-calibrated-weights.md'));
  assert(decisionFiles.includes('0020-prompt-resource-priority.md'));
  assert(decisionFiles.includes('0021-word-library-import-export.md'));
  assert(decisionFiles.includes('0022-textbook-switch.md'));
  assert(decisionFiles.includes('0023-sequential-unit-unlock.md'));
  assert(decisionFiles.includes('0024-retry-and-session-summary.md'));
  assert(decisionFiles.includes('0025-segmentation-audit.md'));
  assert(decisionFiles.includes('0026-session-phase-order.md'));
  assert(decisionFiles.includes('0027-admin-unit-pagination.md'));
  assert(decisionFiles.includes('0028-input-ux-auto-check.md'));
  assert(decisionFiles.includes('0029-auto-practice-selection.md'));
  assert(decisionFiles.includes('0030-unit-mastery-progress.md'));
  assert(decisionFiles.includes('0031-vowel-split-fill.md'));
  assert(decisionFiles.includes('0032-confusable-distractors.md'));
  assert(decisionFiles.includes('0033-history-distractors.md'));
  assert(decisionFiles.includes('0034-judge-claim.md'));
  assert(decisionFiles.includes('0035-visual-polish.md'));
  assert(decisionFiles.includes('0036-auto-review-rows.md'));
  assert(decisionFiles.includes('0037-type-variety.md'));
  assert(decisionFiles.includes('0038-admin-learning-state.md'));
  assert(decisionFiles.includes('0039-review-spacing-and-progress-cap.md'));
  const adr1 = await read('docs/decisions/0001-storage-contract.md');
  const adr2 = await read('docs/decisions/0002-docs-as-code.md');
  assertMatch(adr1, /状态\*\*：Accepted/);
  assertMatch(adr2, /docs-as-code/);
  assertMatch(traceability, /ADR-0001/);
});

test('FILE_SPEC / CONTENT_SPEC：分层、7 方法、V1—V10 校验规则齐全', () => {
  assertMatch(fileSpec, /分层与依赖方向/);
  assertMatch(fileSpec, /7 个方法|7 个存储方法/);
  for (const method of STORAGE_METHODS) assert(fileSpec.includes(method), `FILE_SPEC missing ${method}`);
  for (let index = 1; index <= 10; index += 1) {
    assert(contentSpec.includes(`V${index}`), `CONTENT_SPEC missing V${index}`);
  }
  assertMatch(contentSpec, /人工完成|人工标注|不得由算法/);
});

test('视觉 token：DESIGN §6.2 的核心颜色/圆角/动效均存在', () => {
  for (const token of [
    '--sw-bg',
    '--sw-sky',
    '--sw-mint',
    '--sw-mint-deep',
    '--sw-peach',
    '--sw-ink',
    '--sw-radius-card',
    '--sw-radius-pill',
    '--sw-motion-tap',
    '--sw-ease-bounce',
  ]) {
    assert(tokens.includes(`${token}:`), `tokens.css missing ${token}`);
  }
  assertMatch(tokens, /#FBFAFF/i);
  assertMatch(tokens, /#A8D8F8/i);
  assertMatch(tokens, /#B4E8CC/i);
  assertMatch(tokens, /#7BC9A0/i);
  assertMatch(tokens, /#FFD9C2/i);
  assertMatch(tokens, /#444444/i);
});

test('零依赖与阶段版本：package.json 无 dependencies，版本 0.10.0', () => {
  assertEqual(packageJson.dependencies, undefined);
  assertEqual(packageJson.devDependencies, undefined);
  assertEqual(packageJson.type, 'module');
  assertEqual(packageJson.version, '0.10.0');
  assertEqual(packageJson.scripts['test:p0'], 'node tests/runTests.js --phase=p0');
});

test('README 与 CHANGELOG 交代当前阶段与运行方式', () => {
  assertMatch(readme, /P0/);
  assertMatch(readme, /node tests\/runTests\.js --phase=p9/);
  assertMatch(readme, /docs\/DESIGN\.md/);
  assertMatch(changelog, /P0/);
  assertMatch(changelog, /2026-11-11/);
});
