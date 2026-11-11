/**
 * @layer questionTypes
 * @phase P4
 * @doc §3.4 9 个题型注册表
 */

import { createStubType } from './QuestionType.js';

export const { meta, build, judge } = createStubType({
  id: 'T-SEGMENT',
  phase: 'P4',
  task: '字母间隙点切分点',
  repairs: ['BOUNDARY_OVER_SEGMENT', 'BOUNDARY_UNDER_SEGMENT', 'BOUNDARY_MISPLACED'],
});
