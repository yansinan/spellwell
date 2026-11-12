/**
 * @layer ui
 * @phase P11
 * @doc §2.1 孩子端（学习模块）
 *
 * 练习速度只做历史激励，不参与调度、不写学习状态、不限时。
 */

const MAX_RECORDS = 50;

/**
 * @param {unknown} value
 * @returns {{at: number, elapsedMs: number, questions: number, secondsPerQuestion: number}[]}
 */
export function normalizeSpeedHistory(value) {
  const items = Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : [];
  return items
    .filter((item) => item && Number.isFinite(item.secondsPerQuestion) && item.secondsPerQuestion > 0)
    .map((item) => ({
      at: Number(item.at ?? 0),
      elapsedMs: Number(item.elapsedMs ?? 0),
      questions: Number(item.questions ?? 0),
      secondsPerQuestion: Number(item.secondsPerQuestion),
    }))
    .sort((a, b) => a.at - b.at);
}

/**
 * @param {ReturnType<typeof normalizeSpeedHistory>} history
 * @param {{elapsedMs: number, questions: number, secondsPerQuestion?: number, at?: number}} record
 * @param {number} [max]
 */
export function addSpeedRecord(history, record, max = MAX_RECORDS) {
  const questions = Math.max(1, Number(record.questions ?? 0));
  const elapsedMs = Math.max(0, Number(record.elapsedMs ?? 0));
  const next = {
    at: Number(record.at ?? Date.now()),
    elapsedMs,
    questions,
    secondsPerQuestion: Number(record.secondsPerQuestion ?? elapsedMs / 1000 / questions),
  };
  return [...normalizeSpeedHistory(history), next]
    .sort((a, b) => a.at - b.at)
    .slice(-max);
}

/** @param {ReturnType<typeof normalizeSpeedHistory>} history */
export function bestSpeed(history) {
  const list = normalizeSpeedHistory(history);
  return list.length === 0 ? null : Math.min(...list.map((item) => item.secondsPerQuestion));
}

/** @param {ReturnType<typeof normalizeSpeedHistory>} history */
export function latestSpeed(history) {
  const list = normalizeSpeedHistory(history);
  return list.length === 0 ? null : list[list.length - 1].secondsPerQuestion;
}

/** @param {number} ms */
export function formatElapsed(ms) {
  const seconds = Math.max(0, Math.floor(Number(ms ?? 0) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** @param {number} seconds */
export function formatPace(seconds) {
  return Number.isFinite(seconds) && seconds > 0 ? `${seconds.toFixed(1)}s/q` : '—';
}
