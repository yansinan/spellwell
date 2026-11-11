/**
 * @layer questionTypes
 * @phase P5
 * @doc §3.4 9 个题型注册表
 */

import { createStubType } from './QuestionType.js';

export const { meta, build, judge } = createStubType({
  id: 'T-MATCH',
  phase: 'P5',
  task: '配对/分类',
  repairs: ['SUBSTITUTION', 'BOUNDARY_OVER_SEGMENT', 'BOUNDARY_UNDER_SEGMENT'],
});
