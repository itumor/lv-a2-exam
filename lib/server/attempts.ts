import "server-only";
import { loadExamSet } from "@/lib/content/load";
import { partCount, toPublicSection, type PublicSection } from "@/lib/content/public";
import type { Item } from "@/lib/content/schema";
import {
  beginEvaluation,
  createAttempt,
  currentSkill,
  expireOverdue,
  failEvaluation,
  finishEvaluation,
  isObjective,
  isSpoken,
  isValidPayload,
  outcome,
  saveAnswer,
  scoreObjective,
  scoreSection,
  SKILLS,
  startSection,
  submitAttempt,
  submitSection,
  type AnswerPayload,
  type Attempt,
  type AttemptStatus,
  type EngineError,
  type Outcome,
  type PartialScores,
  type ScorableItem,
  type Skill,
  type TaskScore,
} from "@/lib/exam-engine";
import { parseGrade, providers, type Grade, type Providers } from "@/lib/providers";

// ponytail: in-memory store, one process, lost on restart, no users.
// Replace with Supabase tables + RLS (spec section 6) in the auth/database session.

type Stored = {
  attempt: Attempt;
  title: string;
  grades: Record<string, Grade>;
  taskScores: Partial<Record<Skill, Record<number, TaskScore>>>;
  practiseNext: string | null;
};

export const MAX_ATTEMPTS = 500;
const g = globalThis as { __attempts?: Map<string, Stored> };
const SAMPLE_ID = "mock-exam-1";
const store = (g.__attempts ??= new Map([[SAMPLE_ID, sampleAttempt()]]));

const scorable = (i: Item): ScorableItem => ({ ...i, partCount: partCount(i) });
const itemsOf = (skill: Skill) => loadExamSet().sections[skill];

function read(id: string, now = Date.now()): Stored | undefined {
  const s = store.get(id);
  if (!s) return undefined;
  s.attempt = expireOverdue(s.attempt, now);
  return s;
}

/**
 * Create an attempt and start the listening section.
 * Returns null when the store is full of attempts that are still in progress:
 * a running exam is never evicted to make room for a new one.
 */
export function startExam(now = Date.now()): string | null {
  if (store.size >= MAX_ATTEMPTS) {
    const finished = [...store.keys()].find((k) => k !== SAMPLE_ID && read(k, now)?.attempt.status !== "active");
    if (!finished) return null;
    store.delete(finished);
  }
  const id = crypto.randomUUID();
  const started = startSection(createAttempt(id, loadExamSet().examSetSlug), "listening", now);
  store.set(id, { attempt: started.attempt, title: loadExamSet().title, grades: {}, taskScores: {}, practiseNext: null });
  return id;
}

export type SaveResult = { ok: true; revision: number } | { ok: false; error: EngineError | "not_found" | "invalid_answer" };

/** The section is looked up from the item id on the server; the client never names it. */
export function saveAnswerFor(id: string, itemId: string, payload: unknown, now = Date.now()): SaveResult {
  const s = read(id, now);
  if (!s) return { ok: false, error: "not_found" };
  const skill = SKILLS.find((k) => itemsOf(k).some((i) => i.externalId === itemId));
  const item = skill && itemsOf(skill).find((i) => i.externalId === itemId);
  if (!skill || !item || !isValidPayload(scorable(item), payload)) return { ok: false, error: "invalid_answer" };
  const r = saveAnswer(s.attempt, skill, itemId, payload, now);
  s.attempt = r.attempt;
  return r.ok ? { ok: true, revision: r.attempt.answers[itemId].revision } : { ok: false, error: r.error };
}

/**
 * Close `fromSkill` if it is still running, then start the next section, or
 * submit and evaluate the attempt when none is left. Idempotent.
 */
export async function advance(id: string, fromSkill: Skill, now = Date.now()): Promise<{ done: boolean } | null> {
  const s = read(id, now);
  if (!s) return null;
  if (s.attempt.sections[fromSkill].status === "in_progress") s.attempt = submitSection(s.attempt, fromSkill, now).attempt;
  const next = currentSkill(s.attempt);
  if (next) {
    s.attempt = startSection(s.attempt, next, now).attempt;
    return { done: false };
  }
  if (s.attempt.status === "active") {
    s.attempt = submitAttempt(s.attempt, now).attempt;
    await evaluate(s, providers, now);
  }
  return { done: true };
}

const textOf = (p: AnswerPayload | undefined) => (p && "text" in p ? p.text : "");

/** Score every section. Objective items use the key; open items go through the grader. */
export async function evaluate(s: Stored, p: Providers, now = Date.now()): Promise<void> {
  const begun = beginEvaluation(s.attempt);
  if (!begun.ok) return;
  s.attempt = begun.attempt;
  try {
    const scores = {} as PartialScores;
    for (const skill of SKILLS) {
      const items = itemsOf(skill);
      const answers = Object.fromEntries(items.map((i) => [i.externalId, s.attempt.answers[i.externalId]?.payload]));
      const points: Record<string, number> = {};
      for (const item of items.filter((i) => !isObjective(i.kind))) {
        const answer = answers[item.externalId];
        let learnerText = textOf(answer);
        if (isSpoken(item.kind)) {
          const recordings = answer && "recordings" in answer ? answer.recordings : [];
          const parts = await Promise.all(
            recordings.map((r) => p.speechToText.transcribe({ audio: null, durationSec: r?.durationSec ?? 0, language: "lv-LV" })),
          );
          learnerText = parts.map((t) => t.text).join("\n");
        }
        try {
          const raw = await p.grader.grade({ rubricVersion: item.rubricVersion, maxPoints: item.maxPoints, prompt: item.prompt.lv, learnerText });
          const grade = parseGrade(raw, item.maxPoints);
          s.grades[item.externalId] = grade;
          points[item.externalId] = grade.points;
        } catch {
          // Invalid or missing grade: leave the item unevaluated so the section stays pending.
        }
      }
      const section = scoreSection(items.map(scorable), answers, points);
      scores[skill] = section.score;
      s.taskScores[skill] = section.byTask;
    }
    s.attempt = finishEvaluation(s.attempt, scores, now).attempt;
    const o = outcome(scores);
    if (o.status === "final") {
      const weakest = SKILLS.reduce((a, b) => ((scores[b] ?? 0) < (scores[a] ?? 0) ? b : a));
      s.practiseNext = `More ${weakest} practice`;
    }
  } catch {
    s.attempt = failEvaluation(s.attempt).attempt;
  }
}

// ---------- views (client-safe: no answer keys) ----------

export type RunnerView =
  | { state: "running" | "section_closed"; attemptId: string; skill: Skill; deadlineAt: number; serverNow: number; section: PublicSection; answers: Record<string, AnswerPayload> }
  | { state: "finished"; attemptId: string };

export function getRunnerView(id: string, now = Date.now()): RunnerView | null {
  const s = read(id, now);
  if (!s) return null;
  const a = s.attempt;
  if (a.status !== "active") return { state: "finished", attemptId: id };
  // The section to show: the running one, else the last closed one (waiting for "continue").
  const running = SKILLS.find((k) => a.sections[k].status === "in_progress");
  const skill = running ?? [...SKILLS].reverse().find((k) => a.sections[k].startedAt !== null) ?? "listening";
  const section = toPublicSection(loadExamSet(), skill);
  const answers: Record<string, AnswerPayload> = {};
  for (const i of section.items) {
    const saved = a.answers[i.externalId];
    if (saved) answers[i.externalId] = saved.payload;
  }
  return {
    state: running ? "running" : "section_closed",
    attemptId: id,
    skill,
    deadlineAt: a.sections[skill].deadlineAt ?? now,
    serverNow: now,
    section,
    answers,
  };
}

export type ResultsView = {
  attemptId: string;
  title: string;
  status: AttemptStatus;
  scores: PartialScores;
  outcome: Outcome;
  writingTasks: { task: number; score: number | null; max: number }[];
  practiseNext: string | null;
};

/** Results exist only after all four parts are submitted. */
export function getResultsView(id: string): ResultsView | null {
  const s = read(id);
  if (!s || !["completed", "needs_review", "failed", "evaluating", "submitted"].includes(s.attempt.status)) return null;
  const scores = Object.fromEntries(SKILLS.map((k) => [k, s.attempt.sections[k].score])) as PartialScores;
  return {
    attemptId: id,
    title: s.title,
    status: s.attempt.status,
    scores,
    outcome: outcome(scores),
    writingTasks: Object.entries(s.taskScores.writing ?? {}).map(([task, t]) => ({ task: Number(task), ...t })),
    practiseNext: s.practiseNext,
  };
}

const WRITING_TASK_TITLES: Record<number, string> = { 1: "Describing a person", 2: "Word forms", 3: "E-mail to a friend" };

export type FeedbackView = {
  attemptId: string;
  examTitle: string;
  task: number;
  subtitle: string;
  score: number | null;
  max: number;
  learnerText: string;
  targetWords: number | null;
  grade: Grade | null;
  /** Task 2 only: deterministic word-form results. Shown after submission, so the key may be revealed. */
  wordForms: { promptLv: string; given: string; accepted: string; correct: boolean }[];
};

export function getFeedbackView(id: string, task: number): FeedbackView | null {
  const results = getResultsView(id);
  const s = read(id);
  const items = itemsOf("writing").filter((i) => i.taskNumber === task);
  if (!results || !s || items.length === 0) return null;
  const taskScore = results.writingTasks.find((t) => t.task === task);
  const open = items.find((i) => !isObjective(i.kind));
  const answer = (i: Item) => s.attempt.answers[i.externalId]?.payload;
  return {
    attemptId: id,
    examTitle: s.title,
    task,
    subtitle: WRITING_TASK_TITLES[task] ?? "",
    score: taskScore?.score ?? null,
    max: taskScore?.max ?? items.reduce((sum, i) => sum + i.maxPoints, 0),
    learnerText: open ? textOf(answer(open)) : "",
    targetWords: open?.targetWords ?? open?.minWords ?? null,
    grade: open ? (s.grades[open.externalId] ?? null) : null,
    wordForms: items
      .filter((i) => i.kind === "word_form")
      .map((i) => ({
        promptLv: i.prompt.lv,
        given: textOf(answer(i)),
        accepted: i.answerKey && "accepted" in i.answerKey ? i.answerKey.accepted[0] : "",
        correct: scoreObjective(scorable(i), answer(i)) === i.maxPoints,
      })),
  };
}

export type DashboardView = { userName: string; streakDays: number; nextExamTitle: string; last: ResultsView | null };

// ponytail: sample user from the designs. Real profile and history come with Supabase Auth.
export function getDashboardView(): DashboardView {
  return { userName: "Ebrahim", streakDays: 5, nextExamTitle: `Full ${loadExamSet().title.toLowerCase()}`, last: getResultsView(SAMPLE_ID) };
}

// ---------- sample data from the designs ("Mock exam 1": 12 / 11 / 7 / 10) ----------

function sampleAttempt(): Stored {
  const t0 = Date.UTC(2026, 10, 9, 9, 0, 0);
  let a = createAttempt(SAMPLE_ID, "a2-original-001");
  let t = t0;
  for (const skill of SKILLS) {
    a = startSection(a, skill, t).attempt;
    if (skill === "writing") {
      a = saveAnswer(a, skill, "A2-ORIGINAL-001-W3-Q1", {
        text: "Sveiks, Jāni!\nSestdien es biju uz koncerts. Man patīk mūziku, bet biļete bija dārga.\nUz redzēšanos!\nEbrahim",
      }, t).attempt;
    }
    a = submitSection(a, skill, (t += 20 * 60_000)).attempt;
  }
  a = beginEvaluation(submitAttempt(a, t).attempt).attempt;
  a = finishEvaluation(a, { listening: 12, reading: 11, writing: 7, speaking: 10 }, t).attempt;
  const grade: Grade = {
    points: 3,
    rubricVersion: "a2-2026-v1",
    modelId: "sample-data",
    criterionEvidence: [
      { criterion: "content", labelEn: "Content", labelAr: "المحتوى", points: 1, maxPoints: 2, explanation: "Plan point 4 is missing.", learnerQuote: "" },
      { criterion: "genre", labelEn: "E-mail form", labelAr: "شكل الرسالة", points: 1, maxPoints: 2, explanation: "Greeting and closing are present; the text is short.", learnerQuote: "Sveiks, Jāni!" },
      { criterion: "language", labelEn: "Language", labelAr: "اللغة", points: 1, maxPoints: 2, explanation: "Two case and tense errors.", learnerQuote: "es biju uz koncerts" },
    ],
    corrections: [
      {
        quote: "es biju uz koncerts",
        original: "Es biju uz koncerts.",
        corrected: "Es biju koncertā.",
        explanationEn: "To say where you were, use the locative ending: koncerts becomes koncertā. No preposition is needed.",
        explanationAr: "للتعبير عن المكان الذي كنت فيه، استخدم نهاية حالة المكان (اللوكاتيف): koncerts تصبح koncertā. لا حاجة إلى حرف جر.",
      },
      {
        quote: "Man patīk mūziku",
        original: "Man patīk mūziku.",
        corrected: "Man patika mūzika.",
        explanationEn: "With patikt, the thing you like stays in the nominative. The concert is over, so use the past tense patika.",
        explanationAr: "مع الفعل patikt يبقى الشيء الذي يعجبك في حالة الرفع (النوميناتيف). الحفل انتهى، لذلك استخدم صيغة الماضي patika.",
      },
    ],
    missing: [
      {
        planPoint: 4,
        explanationEn: "You did not invite your friend to the next concert. Try:",
        explanationAr: "لم تدعُ صديقك إلى الحفل القادم. جرّب:",
        suggestionLv: "Nāc ar mani uz nākamo koncertu!",
      },
    ],
    uncertainty: "low",
    uncertaintyReason: "Sample data from the design.",
    nextPractice: "locative endings",
    nextPracticeAr: "نهايات حالة المكان",
  };
  return {
    attempt: a,
    title: "Mock exam 1",
    grades: { "A2-ORIGINAL-001-W3-Q1": grade },
    taskScores: { writing: { 1: { score: 2, max: 4 }, 2: { score: 2, max: 5 }, 3: { score: 3, max: 6 } } },
    practiseNext: "Short emails and word endings",
  };
}
