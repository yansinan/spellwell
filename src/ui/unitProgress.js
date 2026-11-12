/**
 * @layer ui
 * @phase P9
 * @doc §2.1 孩子端（学习模块）
 *
 * 单元顺序解锁：已完成单元 + 下一个未完成单元；后续单元不显示。
 * 完成定义：该 unit 的所有词都至少完成过一次练习（有 wordState）。
 */

/**
 * @param {Array<{id: string, grade?: number, term?: string, unit?: number, count: number, practiced?: number, completed?: boolean}>} units
 * @returns {Array<{id: string, status: 'completed'|'in-progress'|'next'}>}
 */
export function orderUnits(units) {
  return [...units].sort((a, b) => {
    const grade = Number(a.grade ?? 0) - Number(b.grade ?? 0);
    if (grade !== 0) return grade;
    const term = String(a.term ?? '上') === String(b.term ?? '上') ? 0 : String(a.term) === '上' ? -1 : 1;
    if (term !== 0) return term;
    return Number(a.unit ?? 0) - Number(b.unit ?? 0);
  });
}

/**
 * @param {Array<{id: string, count: number, practiced?: number, completed?: boolean}>} units
 * @returns {{visible: any[], completed: any[], current: any|null}}
 */
export function visibleUnitProgress(units) {
  const ordered = orderUnits(units);
  const completed = [];
  let current = null;
  for (const unit of ordered) {
    if (unit.completed) {
      completed.push(unit);
      continue;
    }
    current = unit;
    break;
  }
  const visible = current ? [...completed, current] : [...completed];
  return { visible, completed, current };
}

/**
 * 自动练习选择：
 * - 所有 learned && !mastered 的单元（记忆周期内）；
 * - 如果它们都已 completed 且题量不足，补下一个新单元；
 * - 没有复习单元时，只有已有学习历史才自动带入下一个新单元。
 * @param {Array<{id: string, count: number, practiced?: number, completed?: boolean, mastered?: boolean}>} units
 * @param {number} target
 */
export function selectAutoUnits(units, target = 20) {
  const ordered = orderUnits(units);
  const review = ordered.filter((unit) => (unit.practiced ?? 0) > 0 && !unit.mastered);
  const history = ordered.some((unit) => (unit.practiced ?? 0) > 0);
  const nextNew = ordered.find((unit) => (unit.practiced ?? 0) === 0) ?? null;
  const selected = [...review];
  const reviewWords = review.reduce((sum, unit) => sum + unit.count, 0);
  const allReviewComplete = review.length > 0 && review.every((unit) => unit.completed);
  if (review.length === 0) {
    if (nextNew) selected.push(nextNew);
  } else if (allReviewComplete && reviewWords < target && nextNew) {
    selected.push(nextNew);
  }
  return {
    selected,
    review,
    nextNew,
    reviewWords,
    allReviewComplete,
    autoStart: selected.length > 0 && (review.length > 0 || history || selected.length === 1),
  };
}
