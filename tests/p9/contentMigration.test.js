/**
 * @layer tests
 * @phase P9
 * @doc §5.3 存储层平移策略
 */

import { MemoryAdapter } from '../../src/storage/MemoryAdapter.js';
import { migrateContentV2ToV3 } from '../../src/storage/contentImport.js';
import { assertEqual, test } from '../harness.js';

test('内容 v2→v3：保留已编辑词，补齐 grade/term/unit', async () => {
  const adapter = new MemoryAdapter({
    initialData: {
      words: [
        { id: 'w.custom', text: 'custom', unitId: 'u1-2', units: [], reviewStatus: 'unreviewed' },
        { id: 'w.old', text: 'old', level: 2, units: [], reviewStatus: 'unreviewed' },
      ],
      meta: [{ key: 'contentVersion', value: 2 }],
    },
  });
  await adapter.init();
  const result = await migrateContentV2ToV3(adapter);
  assertEqual(result.migrated, true);
  const custom = await adapter.get('words', 'w.custom');
  assertEqual(custom.grade, 1);
  assertEqual(custom.term, '下');
  assertEqual(custom.unit, 2);
  assertEqual(custom.unitId, 'g1-s2-u2');
  const old = await adapter.get('words', 'w.old');
  assertEqual(old.unitId, 'g2-s1-u1');
  assertEqual((await adapter.get('meta', 'contentVersion')).value, 3);
});
