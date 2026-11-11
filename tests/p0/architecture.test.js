/**
 * @layer tests
 * @phase P0
 * @doc §3.2 三层解耦架构
 *
 * 把 DESIGN 的铁律写成会失败的测试。任何阶段都不得删除或跳过本文件。
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STORAGE_METHODS } from '../../src/storage/StorageAdapter.js';
import { assertDeepEqual, assertEqual, test } from '../harness.js';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testsDir, '..', '..');
const srcDir = path.join(projectRoot, 'src');
const designPath = path.join(projectRoot, 'docs', 'DESIGN.md');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

const files = await walk(srcDir);
const sources = new Map();
for (const file of files) {
  const relative = path.relative(projectRoot, file);
  sources.set(relative, await readFile(file, 'utf8'));
}

const design = await readFile(designPath, 'utf8');
const designSections = new Set(
  [...design.matchAll(/^#{2,4}\s+(\d+(?:\.\d+)?)/gm)].map((match) => match[1]),
);

/**
 * @param {string} relative
 * @returns {string}
 */
function layerOf(relative) {
  const parts = relative.split(path.sep);
  return parts[0] === 'src' ? parts[1] : 'app';
}

/**
 * @param {string} relative
 * @returns {string}
 */
function headerOf(relative) {
  return relative.split(path.sep).slice(0, 2).join(path.sep);
}

/**
 * @param {string} source
 * @returns {string[]}
 */
function importSpecs(source) {
  const specs = new Set();
  for (const match of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) specs.add(match[1]);
  for (const match of source.matchAll(/\bimport\s+['"]([^'"]+)['"]/g)) specs.add(match[1]);
  for (const match of source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g)) specs.add(match[1]);
  return [...specs];
}

/**
 * @param {string} relative
 * @param {string} specifier
 * @returns {string|null}
 */
function resolveImport(relative, specifier) {
  if (!specifier.startsWith('.')) return null;
  const fromDir = path.dirname(path.join(projectRoot, relative));
  const resolved = path.resolve(fromDir, specifier);
  return path.relative(projectRoot, resolved);
}

const ALLOWED_LAYERS = {
  core: ['core'],
  storage: ['core', 'storage'],
  repositories: ['core', 'storage', 'repositories'],
  scheduler: ['core', 'repositories', 'scheduler', 'questionTypes'],
  questionTypes: ['core', 'questionTypes'],
  input: ['core', 'input'],
  admin: ['core', 'storage', 'repositories', 'admin'],
};

test('架构：每个 src 文件都有 @layer/@phase/@doc 头，且 layer 与目录一致', () => {
  const violations = [];
  for (const [relative, source] of sources) {
    const header = source.match(/^\s*\/\*\*([\s\S]*?)\*\//);
    if (!header) {
      violations.push(`${relative}: missing file header`);
      continue;
    }
    const layerMatch = header[1].match(/@layer\s+([A-Za-z]+)/);
    const phaseMatch = header[1].match(/@phase\s+(P(?:10|[0-9]))/);
    const docMatch = header[1].match(/@doc\s+§(\d+(?:\.\d+)?)/);
    if (!layerMatch) violations.push(`${relative}: missing @layer`);
    if (!phaseMatch) violations.push(`${relative}: missing @phase`);
    if (!docMatch) violations.push(`${relative}: missing @doc §x.y`);
    if (layerMatch && layerMatch[1] !== layerOf(relative)) {
      violations.push(`${relative}: @layer ${layerMatch[1]} != directory ${layerOf(relative)}`);
    }
    if (docMatch && !designSections.has(docMatch[1])) {
      violations.push(`${relative}: @doc §${docMatch[1]} does not exist in DESIGN`);
    }
  }
  assertDeepEqual(violations, []);
});

test('架构：依赖只能向下，禁止越层 import', () => {
  const violations = [];
  for (const [relative, source] of sources) {
    const fromLayer = layerOf(relative);
    for (const specifier of importSpecs(source)) {
      const target = resolveImport(relative, specifier);
      if (!target) {
        violations.push(`${relative}: bare import "${specifier}" is not allowed`);
        continue;
      }
      const targetLayer = layerOf(target);
      if (fromLayer === 'ui') continue;
      const allowed = ALLOWED_LAYERS[fromLayer] ?? [];
      if (!allowed.includes(targetLayer)) {
        violations.push(`${relative}: ${fromLayer} -> ${targetLayer} (${target})`);
      }
      if (fromLayer === 'scheduler' && targetLayer === 'questionTypes' && target !== 'src/questionTypes/registry.js') {
        violations.push(`${relative}: scheduler may only import questionTypes/registry.js, got ${target}`);
      }
    }
  }
  assertDeepEqual(violations, []);
});

test('架构：禁止循环依赖', () => {
  const graph = new Map();
  for (const [relative, source] of sources) {
    const targets = importSpecs(source)
      .map((specifier) => resolveImport(relative, specifier))
      .filter((target) => target && sources.has(target));
    graph.set(relative, targets);
  }

  const state = new Map();
  const stack = [];
  const cycles = [];

  /**
   * @param {string} node
   */
  function visit(node) {
    const color = state.get(node) ?? 0;
    if (color === 2) return;
    if (color === 1) {
      const index = stack.indexOf(node);
      cycles.push([...stack.slice(index), node].join(' -> '));
      return;
    }
    state.set(node, 1);
    stack.push(node);
    for (const target of graph.get(node) ?? []) visit(target);
    stack.pop();
    state.set(node, 2);
  }

  for (const node of graph.keys()) visit(node);
  assertDeepEqual(cycles, []);
});

test('架构：禁止环境随机数，随机只能来自 seed', () => {
  const violations = [];
  for (const [relative, source] of sources) {
    if (/Math\.random/.test(source)) violations.push(`${relative}: Math.random`);
    if (/\bcrypto\.(?:getRandomValues|randomUUID)\b/.test(source)) {
      violations.push(`${relative}: crypto random is not seed-deterministic`);
    }
  }
  assertDeepEqual(violations, []);
});

test('架构：题型层/调度层/仓库层/核心层不得触碰 DOM', () => {
  const violations = [];
  const forbidden = /\b(document|window|localStorage|sessionStorage|HTMLElement|navigator)\b/;
  for (const [relative, source] of sources) {
    const layer = layerOf(relative);
    if (['core', 'storage', 'repositories', 'scheduler', 'questionTypes'].includes(layer)) {
      if (forbidden.test(source)) violations.push(`${relative}: DOM global in ${layer}`);
    }
  }
  assertDeepEqual(violations, []);
});

test('架构：indexedDB 只允许出现在 IndexedDBAdapter', () => {
  const violations = [];
  for (const [relative, source] of sources) {
    if (/\bindexedDB\b/.test(source) && relative !== path.join('src', 'storage', 'IndexedDBAdapter.js')) {
      violations.push(`${relative}: indexedDB outside IndexedDBAdapter`);
    }
  }
  assertDeepEqual(violations, []);
});

test('架构：仓库层只调用 adapter 的 7 个方法', () => {
  const violations = [];
  for (const [relative, source] of sources) {
    if (layerOf(relative) !== 'repositories') continue;
    for (const match of source.matchAll(/\badapter\.([A-Za-z_$][\w$]*)\s*\(/g)) {
      if (!STORAGE_METHODS.includes(match[1])) {
        violations.push(`${relative}: adapter.${match[1]}() is outside the storage contract`);
      }
    }
    if (/\b(indexedDB|fetch|localStorage|sessionStorage)\b/.test(source)) {
      violations.push(`${relative}: repository touches a concrete storage/network API`);
    }
  }
  assertDeepEqual(violations, []);
});

test('架构：禁止 default export', () => {
  const violations = [];
  for (const [relative, source] of sources) {
    if (/\bexport\s+default\b/.test(source)) violations.push(`${relative}: export default`);
  }
  assertDeepEqual(violations, []);
});

test('架构：每个 src 文件声明了已知 phase，且与目录头一致', () => {
  const violations = [];
  for (const [relative, source] of sources) {
    const header = source.match(/^\s*\/\*\*([\s\S]*?)\*\//);
    const phase = header?.[1].match(/@phase\s+(P(?:10|[0-9]))/)?.[1];
    if (!phase) continue;
    if (Number(phase.slice(1)) > 10) violations.push(`${relative}: invalid phase ${phase}`);
    assertEqual(headerOf(relative), path.join('src', layerOf(relative)));
  }
  assertDeepEqual(violations, []);
});
