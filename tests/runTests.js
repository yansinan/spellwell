/**
 * @layer tests
 * @phase P0
 * @doc §四、分阶段开发规划
 *
 * 阶段门 runner：
 *   node tests/runTests.js --phase=p0   # 只跑 P0
 *   node tests/runTests.js --phase=p2   # 累计跑 p0..p2
 *   node tests/runTests.js              # 跑仓库里已存在的最高阶段
 *   node tests/runTests.js --phase=all
 *
 * 输出以 PASS/FAIL 开头，退出码 0/1，供 CI 与 agent 判断。
 */

import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getRegisteredTests, setActiveFile } from './harness.js';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(testsDir);
const PHASE_PATTERN = /^p(1[0-2]|[0-9])$/;

/**
 * @param {number} num
 * @returns {string}
 */
function phaseName(num) {
  return `p${num}`;
}

function parseArgs(argv) {
  let phase = null;
  let verbose = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--verbose') {
      verbose = true;
    } else if (arg.startsWith('--phase=')) {
      phase = arg.slice('--phase='.length);
    } else if (arg === '--phase') {
      phase = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (phase !== null && phase !== 'all' && !PHASE_PATTERN.test(phase)) {
    throw new Error(`invalid --phase value: ${phase} (expected p0..p12 or all)`);
  }
  return { phase, verbose };
}

async function discoverPhaseDirs() {
  const entries = await readdir(testsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && PHASE_PATTERN.test(entry.name))
    .map((entry) => ({
      name: entry.name,
      num: Number(entry.name.slice(1)),
      dir: path.join(testsDir, entry.name),
    }))
    .sort((a, b) => a.num - b.num);
}

/**
 * @param {string} relativeFile
 * @returns {string|null}
 */
function phaseOfFile(relativeFile) {
  const parts = relativeFile.split(path.sep);
  return parts.find((part) => PHASE_PATTERN.test(part)) ?? null;
}

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function findTestFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findTestFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

function usage() {
  console.error('Usage: node tests/runTests.js [--phase=p0|p1|...|p12|all] [--verbose]');
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[runner] ${error.message}`);
    usage();
    process.exitCode = 2;
    return;
  }

  const phaseDirs = await discoverPhaseDirs();
  if (phaseDirs.length === 0) {
    console.error('FAIL  no tests/pN directories found');
    process.exitCode = 1;
    return;
  }

  const maxPhase = phaseDirs[phaseDirs.length - 1];
  let targetNum;
  if (options.phase === 'all') {
    targetNum = maxPhase.num;
  } else if (options.phase === null) {
    targetNum = maxPhase.num;
  } else {
    targetNum = Number(options.phase.slice(1));
  }

  const included = phaseDirs.filter((entry) => entry.num <= targetNum);
  const missing = [];
  if (options.phase !== 'all') {
    for (let num = 0; num <= targetNum; num += 1) {
      if (!included.some((entry) => entry.num === num)) missing.push(phaseName(num));
    }
  }
  if (missing.length > 0) {
    console.error(`FAIL  missing phase test directories: ${missing.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  /** @type {{phase: string, file: string, files: string[]}[]} */
  const groups = [];
  for (const phaseDir of included) {
    const files = await findTestFiles(phaseDir.dir);
    groups.push({ phase: phaseDir.name, file: phaseDir.dir, files });
  }

  const emptyPhases = groups.filter((group) => group.files.length === 0).map((group) => group.phase);
  if (emptyPhases.length > 0) {
    console.error(`FAIL  no *.test.js files in: ${emptyPhases.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const gateLabel = options.phase === 'all'
    ? 'all'
    : `p${targetNum}`;
  console.log(`SpellWell test runner · gate ${gateLabel}`);
  console.log(`phases: ${included.map((entry) => entry.name).join(', ')}`);
  console.log('----------------------------------------');

  let importFailed = 0;
  for (const group of groups) {
    console.log(`\n[${group.phase}]`);
    for (const file of group.files) {
      const relative = path.relative(projectRoot, file);
      setActiveFile(relative);
      try {
        await import(pathToFileURL(file).href);
        if (options.verbose) console.log(`  loaded ${relative}`);
      } catch (error) {
        importFailed += 1;
        console.error(`  ✗ import failed: ${relative}`);
        console.error(error && error.stack ? error.stack : String(error));
      }
    }
  }

  const tests = getRegisteredTests();
  const byPhase = new Map(groups.map((group) => [group.phase, 0]));
  for (const registered of tests) {
    const phase = phaseOfFile(registered.file);
    if (phase && byPhase.has(phase)) byPhase.set(phase, byPhase.get(phase) + 1);
  }
  const phasesWithoutTests = [...byPhase.entries()]
    .filter(([, count]) => count === 0)
    .map(([phase]) => phase);
  if (phasesWithoutTests.length > 0 && importFailed === 0) {
    console.error(`FAIL  phases with no registered tests: ${phasesWithoutTests.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const startedAt = Date.now();
  /** @type {{file: string, name: string, message: string, stack?: string}[]} */
  const failures = [];
  let passed = 0;

  console.log('\n----------------------------------------');
  for (const registered of tests) {
    try {
      await registered.fn();
      passed += 1;
      console.log(`  ✓ ${registered.file} · ${registered.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({
        file: registered.file,
        name: registered.name,
        message,
        stack: error instanceof Error ? error.stack : undefined,
      });
      console.error(`  ✗ ${registered.file} · ${registered.name}`);
      console.error(`    ${message}`);
      if (options.verbose && error instanceof Error && error.stack) {
        console.error(error.stack);
      }
    }
  }

  const durationMs = Date.now() - startedAt;
  const total = passed + failures.length + importFailed;
  const failed = failures.length + importFailed;
  const fileCount = groups.reduce((sum, group) => sum + group.files.length, 0);

  const report = {
    gate: gateLabel,
    phases: included.map((entry) => entry.name),
    generatedAt: new Date().toISOString(),
    durationMs,
    files: fileCount,
    total,
    passed,
    failed,
    failures: failures.map(({ file, name, message }) => ({ file, name, message })),
  };
  try {
    await writeFile(path.join(testsDir, '.last-run.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  } catch {
    // 报告是辅助信息，不阻断门禁。
  }

  console.log('----------------------------------------');
  const summary = `${passed} passed · ${failed} failed · ${fileCount} files`;
  if (failed === 0 && total > 0) {
    console.log(`PASS  ${gateLabel} gate · ${summary}`);
    process.exitCode = 0;
  } else {
    console.log(`FAIL  ${gateLabel} gate · ${summary}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`FAIL  runner crashed: ${error && error.stack ? error.stack : String(error)}`);
  process.exitCode = 1;
});
