/**
 * @layer questionTypes
 * @phase P6
 * @doc §3.4 9 个题型注册表
 */

import { createStubType } from './QuestionType.js';

export const { meta, build, judge } = createStubType({
  id: 'T-CLOZE',
  phase: 'P6',
  task: '英文句子挖空拼写',
  repairs: ['UNKNOWN'],
});
