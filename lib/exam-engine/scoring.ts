// Deterministic scoring for listening, reading and writing task 2 (spec section 9).

export type ItemKind =
  | "single_choice"
  | "true_false"
  | "word_bank"
  | "match"
  | "word_form"
  | "free_text"
  | "interview"
  | "picture_description"
  | "ask_questions";

const CHOICE_KINDS: ItemKind[] = ["single_choice", "true_false", "word_bank", "match"];
const SPOKEN_KINDS: ItemKind[] = ["interview", "picture_description", "ask_questions"];

export const isChoice = (k: ItemKind) => CHOICE_KINDS.includes(k);
export const isSpoken = (k: ItemKind) => SPOKEN_KINDS.includes(k);
/** Objective items are scored against a key. Everything else needs an evaluation. */
export const isObjective = (k: ItemKind) => isChoice(k) || k === "word_form";

export type AnswerKey = { correct: string } | { accepted: string[] };

export type ScorableItem = {
  externalId: string;
  taskNumber: number;
  kind: ItemKind;
  maxPoints: number;
  options?: { id: string }[];
  answerKey?: AnswerKey | null;
  /** Number of recordings a spoken item expects (questions, pictures, adverts). */
  partCount?: number;
};

export type Recording = { durationSec: number };
export type AnswerPayload = { choice: string } | { text: string } | { recordings: (Recording | null)[] };

export const MAX_TEXT_LENGTH = 2000;
export const MAX_RECORDING_SEC = 300;

/** Learner input is untrusted: accept only the shape that fits the item. */
export function isValidPayload(item: ScorableItem, payload: unknown): payload is AnswerPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  if (Object.keys(p).length !== 1) return false;
  if (isChoice(item.kind)) {
    return typeof p.choice === "string" && (item.options ?? []).some((o) => o.id === p.choice);
  }
  if (item.kind === "word_form" || item.kind === "free_text") {
    return typeof p.text === "string" && p.text.length <= MAX_TEXT_LENGTH;
  }
  if (!Array.isArray(p.recordings) || p.recordings.length > (item.partCount ?? 1)) return false;
  return p.recordings.every((r) => {
    if (r === null) return true;
    const d = (r as Record<string, unknown> | undefined)?.durationSec;
    return typeof d === "number" && Number.isFinite(d) && d >= 0 && d <= MAX_RECORDING_SEC;
  });
}

export const normalizeWord = (s: string) => s.normalize("NFC").trim().toLocaleLowerCase("lv").replace(/\s+/g, " ");

/** All-or-nothing score for one objective item. A missing answer scores 0. */
export function scoreObjective(item: ScorableItem, payload: AnswerPayload | undefined): number {
  if (!isObjective(item.kind)) throw new Error(`${item.externalId}: ${item.kind} is not objective`);
  if (!item.answerKey) throw new Error(`${item.externalId}: missing answer key`);
  if (!payload) return 0;
  if ("correct" in item.answerKey) {
    return "choice" in payload && payload.choice === item.answerKey.correct ? item.maxPoints : 0;
  }
  if (!("text" in payload)) return 0;
  const given = normalizeWord(payload.text);
  return item.answerKey.accepted.some((a) => normalizeWord(a) === given) ? item.maxPoints : 0;
}

/** Reject grader output outside 0..max (e.g. 9 points for a 6-point task). */
export function acceptEvaluation(points: unknown, maxPoints: number): number {
  if (typeof points !== "number" || !Number.isInteger(points) || points < 0 || points > maxPoints) {
    throw new RangeError(`Evaluation points ${String(points)} are outside 0..${maxPoints}`);
  }
  return points;
}

export type TaskScore = { score: number | null; max: number };
export type SectionScore = { score: number | null; byTask: Record<number, TaskScore> };

/**
 * Score one section. Objective items use the key; open items use `evaluations`
 * (points per item id). Any open item without an evaluation makes its task and
 * the section score null (pending) — never 0.
 */
export function scoreSection(
  items: ScorableItem[],
  answers: Record<string, AnswerPayload | undefined>,
  evaluations: Record<string, number | undefined> = {},
): SectionScore {
  const byTask: Record<number, TaskScore> = {};
  for (const item of items) {
    const t = (byTask[item.taskNumber] ??= { score: 0, max: 0 });
    t.max += item.maxPoints;
    let points: number | null;
    if (isObjective(item.kind)) points = scoreObjective(item, answers[item.externalId]);
    else {
      const e = evaluations[item.externalId];
      points = e === undefined ? null : acceptEvaluation(e, item.maxPoints);
    }
    t.score = t.score === null || points === null ? null : t.score + points;
  }
  const tasks = Object.values(byTask);
  const score = tasks.some((t) => t.score === null) ? null : tasks.reduce((sum, t) => sum + (t.score ?? 0), 0);
  return { score, byTask };
}
