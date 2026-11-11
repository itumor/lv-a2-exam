// Attempt and section state machines (spec section 7). Pure: every function takes
// `now` (UTC epoch ms from the SERVER clock) and returns a new attempt.
// The persisted deadline is authoritative; client clocks are never trusted.

import { outcome, SECTION_MINUTES, SKILLS, type PartialScores, type Skill } from "./rules";
import type { AnswerPayload } from "./scoring";

export type AttemptStatus = "created" | "active" | "submitted" | "evaluating" | "completed" | "needs_review" | "failed";
export type SectionStatus = "not_started" | "in_progress" | "submitted" | "expired";

export type SectionState = {
  status: SectionStatus;
  startedAt: number | null;
  deadlineAt: number | null;
  submittedAt: number | null;
  score: number | null;
};

export type SavedAnswer = { payload: AnswerPayload; revision: number; savedAt: number };

export type Attempt = {
  id: string;
  examSetSlug: string;
  mode: "exam";
  status: AttemptStatus;
  startedAt: number | null;
  submittedAt: number | null;
  completedAt: number | null;
  sections: Record<Skill, SectionState>;
  answers: Record<string, SavedAnswer>;
  totalScore: number | null;
  passed: boolean | null;
};

export type EngineError = "invalid_state" | "wrong_section" | "section_closed" | "deadline_passed" | "stale_revision";
export type Result = { ok: true; attempt: Attempt } | { ok: false; error: EngineError; attempt: Attempt };

const ok = (attempt: Attempt): Result => ({ ok: true, attempt });
const fail = (attempt: Attempt, error: EngineError): Result => ({ ok: false, error, attempt });

const isClosed = (s: SectionState) => s.status === "submitted" || s.status === "expired";

export function createAttempt(id: string, examSetSlug: string): Attempt {
  const section = (): SectionState => ({ status: "not_started", startedAt: null, deadlineAt: null, submittedAt: null, score: null });
  return {
    id,
    examSetSlug,
    mode: "exam",
    status: "created",
    startedAt: null,
    submittedAt: null,
    completedAt: null,
    sections: { listening: section(), reading: section(), writing: section(), speaking: section() },
    answers: {},
    totalScore: null,
    passed: null,
  };
}

/** The first section that is not closed, or null when all four are closed. */
export const currentSkill = (a: Attempt): Skill | null => SKILLS.find((k) => !isClosed(a.sections[k])) ?? null;

const withSection = (a: Attempt, skill: Skill, patch: Partial<SectionState>): Attempt => ({
  ...a,
  sections: { ...a.sections, [skill]: { ...a.sections[skill], ...patch } },
});

/** Freeze every running section whose deadline has passed. Call before any read or write. */
export function expireOverdue(a: Attempt, now: number): Attempt {
  let next = a;
  for (const skill of SKILLS) {
    const s = next.sections[skill];
    if (s.status === "in_progress" && s.deadlineAt !== null && now >= s.deadlineAt) {
      next = withSection(next, skill, { status: "expired", submittedAt: s.deadlineAt });
    }
  }
  return next;
}

/** Start a section. Idempotent: a retry returns the same deadline. Sections run in the official order. */
export function startSection(attempt: Attempt, skill: Skill, now: number): Result {
  const a = expireOverdue(attempt, now);
  if (a.status !== "created" && a.status !== "active") return fail(a, "invalid_state");
  const s = a.sections[skill];
  if (s.status === "in_progress") return ok(a);
  if (isClosed(s)) return fail(a, "section_closed");
  if (currentSkill(a) !== skill) return fail(a, "wrong_section");
  const started = withSection(a, skill, {
    status: "in_progress",
    startedAt: now,
    deadlineAt: now + SECTION_MINUTES[skill] * 60_000,
  });
  return ok({ ...started, status: "active", startedAt: a.startedAt ?? now });
}

/** Save one answer. Rejected after the deadline or once the section is closed. */
export function saveAnswer(
  attempt: Attempt,
  skill: Skill,
  itemId: string,
  payload: AnswerPayload,
  now: number,
  clientRevision?: number,
): Result {
  const a = expireOverdue(attempt, now);
  if (a.status !== "active") return fail(a, "invalid_state");
  const s = a.sections[skill];
  if (s.status === "expired") return fail(a, "deadline_passed");
  if (s.status !== "in_progress") return fail(a, "section_closed");
  const prev = a.answers[itemId];
  if (clientRevision !== undefined && prev && clientRevision < prev.revision) return fail(a, "stale_revision");
  const saved: SavedAnswer = { payload, revision: (prev?.revision ?? 0) + 1, savedAt: now };
  return ok({ ...a, answers: { ...a.answers, [itemId]: saved } });
}

/** Freeze a section. Idempotent: submitting a closed section changes nothing. */
export function submitSection(attempt: Attempt, skill: Skill, now: number): Result {
  const a = expireOverdue(attempt, now);
  const s = a.sections[skill];
  if (isClosed(s)) return ok(a);
  if (a.status !== "active" || s.status !== "in_progress") return fail(a, "invalid_state");
  return ok(withSection(a, skill, { status: "submitted", submittedAt: now }));
}

/** active -> submitted, once all four sections are closed. Idempotent. */
export function submitAttempt(attempt: Attempt, now: number): Result {
  const a = expireOverdue(attempt, now);
  if (a.status !== "active") return a.status === "created" ? fail(a, "invalid_state") : ok(a);
  if (currentSkill(a) !== null) return fail(a, "invalid_state");
  return ok({ ...a, status: "submitted", submittedAt: now });
}

/** submitted -> evaluating. Also allows a retry from needs_review or failed. */
export function beginEvaluation(a: Attempt): Result {
  if (a.status === "evaluating") return ok(a);
  if (a.status !== "submitted" && a.status !== "needs_review" && a.status !== "failed") return fail(a, "invalid_state");
  return ok({ ...a, status: "evaluating" });
}

/**
 * evaluating -> completed when all four scores exist, else needs_review.
 * A pending score leaves totalScore and passed null: neither pass nor fail.
 * Learner answers are never touched here.
 */
export function finishEvaluation(a: Attempt, scores: PartialScores, now: number): Result {
  if (a.status !== "evaluating") return fail(a, "invalid_state");
  const sections = { ...a.sections };
  for (const skill of SKILLS) sections[skill] = { ...sections[skill], score: scores[skill] };
  const o = outcome(scores);
  if (o.status === "pending") return ok({ ...a, sections, status: "needs_review", totalScore: null, passed: null });
  return ok({ ...a, sections, status: "completed", completedAt: now, totalScore: o.total, passed: o.passed });
}

/** A provider failure leaves the attempt retryable, with frozen answers unchanged. */
export function failEvaluation(a: Attempt): Result {
  if (a.status !== "evaluating") return fail(a, "invalid_state");
  return ok({ ...a, status: "failed" });
}
