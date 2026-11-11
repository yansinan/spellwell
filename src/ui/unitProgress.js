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
