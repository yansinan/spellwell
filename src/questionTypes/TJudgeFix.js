/**
 * @layer questionTypes
 * @phase P6
 * @doc §3.4 9 个题型注册表
 */

import { createStubType } from './QuestionType.js';

export const { meta, build, judge } = createStubType({
  id: 'T-JUDGE-FIX',
  phase: 'P6',
  task: '判断对错并改对',
  repairs: [
    'SUBSTITUTION',
    'BOUNDARY_OVER_SEGMENT',
    'BOUNDARY_UNDER_SEGMENT',
    'BOUNDARY_MISPLACED',
    'UNKNOWN',
  ],
});
