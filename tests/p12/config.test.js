/**
 * @layer tests
 * @phase P12
 * @doc §5.3 存储层平移策略
 */

import { SYNC_BASE_URL, SYNC_PROJECT_ID } from '../../src/sync/config.js';
import { assertEqual, test } from '../harness.js';

test('同步固定项目：项目 ID 内置，默认走同源 /sync', () => {
  assertEqual(SYNC_PROJECT_ID, 'proj_ZRzMM2YkwEg8Q3AEDPjs_g');
  assertEqual(SYNC_BASE_URL, '/sync');
});
