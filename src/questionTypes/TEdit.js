/**
 * @layer questionTypes
 * @phase P4
 * @doc §3.4 9 个题型注册表
 */

import { createStubType } from './QuestionType.js';

export const { meta, build, judge } = createStubType({
  id: 'T-EDIT',
  phase: 'P4',
  task: '插入/删除/替换/移动修错词',
  repairs: ['OMISSION', 'SUBSTITUTION', 'TRANSPOSITION', 'EXTRA', 'SUFFIX_RULE'],
});
