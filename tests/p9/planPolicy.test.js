/**
 * @layer tests
 * @phase P9
 * @doc §1.3 记忆曲线是调度器，不是装饰
 */

import { PLAN_POLICY_VERSION, revisePlan } from '../../src/scheduler/PlanPolicy.js';
import { assertEqual, test } from '../harness.js';

test('计划策略：P9 保留 revise 接口，不实时改当前计划', () => {
  const plan = { revision: 3, items: [{ wordId: 'w.fish', typeId: 'T-FILL' }] };
  const result = revisePlan({ plan, attempt: { wordCorrect: false } });
  assertEqual(result.changed, false);
  assertEqual(result.policyVersion, PLAN_POLICY_VERSION);
  assertEqual(result.plan, plan);
});
