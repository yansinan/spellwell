/**
 * @layer ui
 * @phase P8
 * @doc §5.3 存储层平移策略
 *
 * 本机数据迁移：导出/导入 8 个 store 的完整快照，仅用于换主机。
 * 不是内容发布通道；内容编辑直接写共享 IndexedDB。
 */

import { IndexedDBAdapter } from '../storage/IndexedDBAdapter.js';

function escape(value) {
  return String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function download(name, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * @param {HTMLElement} root
 */
export async function mountMigration(root) {
  if (!root) throw new Error('MigrationApp needs a root element');
  const adapter = new IndexedDBAdapter();

  const render = (message = '') => {
    root.innerHTML = `
      <section class="sw-panel">
        <h2>本机数据迁移</h2>
        <p>导出/导入包含内容、学习状态和 attempts 的完整快照。仅用于把本机数据迁移到另一台主机。</p>
        <p class="sw-admin__blocked">导入会覆盖本机全部 8 个 store；请先导出备份。</p>
        <div class="sw-admin__toolbar">
          <button type="button" class="sw-text-button" data-export>导出本机数据</button>
          <label class="sw-text-button">导入本机数据<input type="file" accept="application/json" data-import hidden /></label>
          <a class="sw-text-button" href="/src/admin/index.html">返回内容后台</a>
          <a class="sw-text-button" href="/">返回学习端</a>
        </div>
        ${message ? `<p class="sw-admin__notice">${escape(message)}</p>` : ''}
      </section>
    `;

    root.querySelector('[data-export]')?.addEventListener('click', async () => {
      try {
        await adapter.init();
        const snapshot = await adapter.exportAll();
        const counts = Object.fromEntries(Object.entries(snapshot.stores).map(([name, items]) => [name, items.length]));
        download(`spellwell-backup-${snapshot.exportedAt.slice(0, 10)}.json`, snapshot);
        await adapter.close();
        render(`已导出 ${snapshot.schemaVersion} 版本快照：${Object.entries(counts).map(([name, count]) => `${name} ${count}`).join(' · ')}`);
      } catch (error) {
        render(`导出失败：${String(error)}`);
      }
    });

    root.querySelector('[data-import]')?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const snapshot = JSON.parse(await file.text());
        if (!window.confirm('导入会覆盖本机全部数据。确认继续？')) return;
        await adapter.init();
        const result = await adapter.importAll(snapshot);
        await adapter.close();
        render(`已导入 ${result.imported} 条记录；刷新学习端后生效。`);
      } catch (error) {
        render(`导入失败：${String(error)}`);
      }
    });
  };

  render();
}
