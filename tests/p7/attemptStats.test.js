/**
 * @layer tests
 * @phase P7
 * @doc §2.3 内容后台
 */

import { countAttemptsByWord } from '../../src/admin/AttemptStats.js';
import { assertDeepEqual, test } from '../harness.js';

test('后台统计：按词汇总错/对次数，无记录为 0', () => {
  const stats = countAttemptsByWord([
    { wordId: 'w.fish', wordCorrect: true },
    { wordId: 'w.fish', wordCorrect: false },
    { wordId: 'w.fish', wordCorrect: false },
    { wordId: 'w.ship', wordCorrect: true },
    { wordId: '', wordCorrect: false },
  ]);
  assertDeepEqual(stats['w.fish'], { wrong: 2, correct: 1 });
  assertDeepEqual(stats['w.ship'], { wrong: 0, correct: 1 });
  assertDeepEqual(stats[''], undefined);
});
