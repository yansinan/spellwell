/**
 * @layer scheduler
 * @phase P9
 * @doc §1.3 记忆曲线是调度器，不是装饰
 *
 * 计划策略版本与实时微调接口预留。P9 不改变进行中的题；
 * 未来可在 attempt 后用 revise() 调整尚未开始的计划项。
 */

export const PLAN_POLICY_VERSION = 1;

/**
 * @param {{plan: Record<string, any>, attempt: Record<string, any>}} input
 * @returns {{plan: Record<string, any>, changed: boolean, policyVersion: number}}
 */
export function revisePlan({ plan, attempt }) {
  void attempt;
  return { plan, changed: false, policyVersion: PLAN_POLICY_VERSION };
}
