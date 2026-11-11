/**
 * @layer questionTypes
 * @phase P4
 * @doc §3.4 9 个题型注册表
 */

import { createStubType } from './QuestionType.js';

export const { meta, build, judge } = createStubType({
  id: 'T-REORDER',
  phase: 'P4',
  task: '打乱单位排成正确顺序',
  repairs: ['TRANSPOSITION'],
});
