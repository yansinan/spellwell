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
 * 按年级/学期分组；每个序列独立计算“已完成 + 下一个新单元”。
 * @param {Record<string, any>} unit
 */
export function sequenceKey(unit) {
  return `${Number(unit.grade ?? 0)}|${String(unit.term ?? '上')}`;
}

/**
 * @param {Record<string, any>[]} units
 * @returns {Map<string, Record<string, any>[]>}
 */
export function groupSequences(units) {
  const groups = new Map();
  for (const unit of orderUnits(units)) {
    const key = sequenceKey(unit);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(unit);
  }
  return groups;
}

/**
 * 每个序列以最后一个“已练过”的单元为基准，计算下一个未开始单元。
 * @param {Record<string, any>[]} seq
 */
function sequenceNextNew(seq) {
  let lastActive = -1;
  seq.forEach((unit, index) => {
    if ((unit.practiced ?? 0) > 0) lastActive = index;
  });
  const after = lastActive >= 0 ? seq.slice(lastActive + 1) : seq;
  return after.find((unit) => (unit.practiced ?? 0) === 0 && !unit.completed) ?? null;
}

/**
 * @param {Array<{id: string, count: number, practiced?: number, completed?: boolean}>} units
 * @returns {{visible: any[], completed: any[], current: any|null, currents: any[], nextNews: any[], sequences: Map<string, any[]>}}
 */
export function visibleUnitProgress(units) {
  const completed = [];
  const currents = [];
  const nextNews = [];
  const sequences = groupSequences(units);
  for (const seq of sequences.values()) {
    let lastActive = -1;
    seq.forEach((unit, index) => {
      if ((unit.practiced ?? 0) > 0) lastActive = index;
    });
    const after = lastActive >= 0 ? seq.slice(lastActive + 1) : seq;
    const current = after.find((unit) => !unit.completed) ?? null;
    if (current) currents.push(current);
    const next = sequenceNextNew(seq);
    if (next) nextNews.push(next);
    const cutoff = current ? seq.indexOf(current) : seq.length;
    for (const unit of seq.slice(0, cutoff)) {
      if (unit.completed) completed.push(unit);
    }
  }
  completed.sort((a, b) => orderUnits([a, b])[0].id === a.id ? -1 : 1);
  const current = currents[0] ?? null;
  return {
    visible: [...completed, ...currents],
    completed,
    current,
    currents,
    nextNews,
    sequences,
  };
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
  const sequences = groupSequences(units);
  const nextNews = [];
  for (const seq of sequences.values()) {
    const next = sequenceNextNew(seq);
    if (next) nextNews.push(next);
  }
  const selected = [...review];
  const reviewWords = review.reduce((sum, unit) => sum + unit.count, 0);
  const allReviewComplete = review.length > 0 && review.every((unit) => unit.completed);
  if (review.length === 0) {
    selected.push(...nextNews);
  } else if (allReviewComplete && reviewWords < target) {
    selected.push(...nextNews);
  }
  return {
    selected,
    review,
    nextNew: nextNews[0] ?? null,
    nextNews,
    reviewWords,
    allReviewComplete,
    autoStart: selected.length > 0 && (review.length > 0 || history || selected.length === 1),
  };
}
