import { describe, expect, it } from "vitest";
import {
  acceptEvaluation,
  beginEvaluation,
  createAttempt,
  currentSkill,
  failEvaluation,
  finishEvaluation,
  isValidPayload,
  outcome,
  passed,
  saveAnswer,
  scoreObjective,
  scoreSection,
  SECTION_MINUTES,
  SKILLS,
  startSection,
  submitAttempt,
  submitSection,
  totalScore,
  type Attempt,
  type Result,
  type ScorableItem,
} from "@/lib/exam-engine";

const T0 = Date.UTC(2026, 10, 11, 9, 0, 0);
const MIN = 60_000;
const must = (r: Result): Attempt => {
  if (!r.ok) throw new Error(r.error);
  return r.attempt;
};

describe("pass rule", () => {
  it("9/9/9/9 passes with 36 of 60", () => {
    const s = { listening: 9, reading: 9, writing: 9, speaking: 9 };
    expect(passed(s)).toBe(true);
    expect(totalScore(s)).toBe(36);
  });
  it("15/15/8/15 fails with 53 of 60: a high total never compensates", () => {
    const s = { listening: 15, reading: 15, writing: 8, speaking: 15 };
    expect(passed(s)).toBe(false);
    expect(totalScore(s)).toBe(53);
    expect(outcome(s)).toEqual({ status: "final", total: 53, passed: false, below: [{ skill: "writing", short: 1 }] });
  });
  it("rejects non-integers and scores above 15", () => {
    expect(passed({ listening: 9.5, reading: 9, writing: 9, speaking: 9 })).toBe(false);
    expect(passed({ listening: 16, reading: 9, writing: 9, speaking: 9 })).toBe(false);
  });
  it("a pending evaluation is neither pass nor fail", () => {
    const o = outcome({ listening: 15, reading: 15, writing: null, speaking: 15 });
    expect(o).toEqual({ status: "pending", pendingSkills: ["writing"] });
    expect("passed" in o).toBe(false);
  });
});

const choice: ScorableItem = {
  externalId: "L1", taskNumber: 1, kind: "single_choice", maxPoints: 1,
  options: [{ id: "A" }, { id: "B" }, { id: "C" }], answerKey: { correct: "B" },
};
const wordForm: ScorableItem = {
  externalId: "W2", taskNumber: 2, kind: "word_form", maxPoints: 1, answerKey: { accepted: ["vasarai"] },
};
const email: ScorableItem = { externalId: "W3", taskNumber: 3, kind: "free_text", maxPoints: 6 };

describe("deterministic scoring", () => {
  it("scores a choice against the key", () => {
    expect(scoreObjective(choice, { choice: "B" })).toBe(1);
    expect(scoreObjective(choice, { choice: "A" })).toBe(0);
    expect(scoreObjective(choice, undefined)).toBe(0);
  });
  it("scores word forms ignoring case and outer spaces, but not diacritics", () => {
    expect(scoreObjective(wordForm, { text: "  Vasarai " })).toBe(1);
    expect(scoreObjective(wordForm, { text: "vasara" })).toBe(0);
    expect(scoreObjective({ ...wordForm, answerKey: { accepted: ["koncertā"] } }, { text: "koncerta" })).toBe(0);
  });
  it("refuses to score an open item deterministically", () => {
    expect(() => scoreObjective(email, { text: "Sveiks!" })).toThrow();
  });
  it("rejects evaluation points above the task maximum (9 for a 6-point task)", () => {
    expect(() => acceptEvaluation(9, 6)).toThrow(RangeError);
    expect(() => acceptEvaluation(2.5, 6)).toThrow(RangeError);
    expect(() => acceptEvaluation("6", 6)).toThrow(RangeError);
    expect(acceptEvaluation(6, 6)).toBe(6);
  });
  it("section score is pending until every open item is evaluated", () => {
    const items = [wordForm, email];
    const answers = { W2: { text: "vasarai" }, W3: { text: "Sveiks!" } };
    expect(scoreSection(items, answers).score).toBeNull();
    expect(scoreSection(items, answers).byTask[2]).toEqual({ score: 1, max: 1 });
    expect(scoreSection(items, answers, { W3: 3 })).toEqual({
      score: 4,
      byTask: { 2: { score: 1, max: 1 }, 3: { score: 3, max: 6 } },
    });
    expect(() => scoreSection(items, answers, { W3: 9 })).toThrow(RangeError);
  });
});

describe("untrusted answer payloads", () => {
  it("accepts only the shape that fits the item", () => {
    expect(isValidPayload(choice, { choice: "B" })).toBe(true);
    expect(isValidPayload(choice, { choice: "Z" })).toBe(false);
    expect(isValidPayload(choice, { text: "B" })).toBe(false);
    expect(isValidPayload(choice, { choice: "B", extra: 1 })).toBe(false);
    expect(isValidPayload(email, { text: "x".repeat(2001) })).toBe(false);
    expect(isValidPayload(email, null)).toBe(false);
    const spoken: ScorableItem = { externalId: "S2", taskNumber: 2, kind: "picture_description", maxPoints: 6, partCount: 2 };
    expect(isValidPayload(spoken, { recordings: [{ durationSec: 24 }, null] })).toBe(true);
    expect(isValidPayload(spoken, { recordings: [{ durationSec: 24 }, null, null] })).toBe(false);
    expect(isValidPayload(spoken, { recordings: [{ durationSec: -1 }] })).toBe(false);
  });
});

describe("attempt state machine", () => {
  const started = () => must(startSection(createAttempt("a1", "set"), "listening", T0));

  it("created -> active with a server deadline of 25 minutes", () => {
    const a = started();
    expect(a.status).toBe("active");
    expect(a.sections.listening.deadlineAt).toBe(T0 + 25 * MIN);
  });
  it("start is idempotent: a retry keeps the first deadline", () => {
    const again = must(startSection(started(), "listening", T0 + 5 * MIN));
    expect(again.sections.listening.deadlineAt).toBe(T0 + 25 * MIN);
  });
  it("sections run in the official order", () => {
    const r = startSection(started(), "reading", T0);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe("wrong_section");
  });
  it("saves answers with increasing revisions and rejects a stale one", () => {
    let a = must(saveAnswer(started(), "listening", "L1", { choice: "A" }, T0 + MIN));
    a = must(saveAnswer(a, "listening", "L1", { choice: "B" }, T0 + 2 * MIN));
    expect(a.answers.L1).toMatchObject({ payload: { choice: "B" }, revision: 2 });
    const stale = saveAnswer(a, "listening", "L1", { choice: "C" }, T0 + 3 * MIN, 1);
    expect(!stale.ok && stale.error).toBe("stale_revision");
  });
  it("rejects a late answer and marks the section expired", () => {
    const a = must(saveAnswer(started(), "listening", "L1", { choice: "A" }, T0 + MIN));
    const late = saveAnswer(a, "listening", "L1", { choice: "B" }, T0 + 25 * MIN);
    expect(!late.ok && late.error).toBe("deadline_passed");
    expect(late.attempt.sections.listening.status).toBe("expired");
    expect(late.attempt.answers.L1.payload).toEqual({ choice: "A" });
  });
  it("rejects answers after submit; submit is idempotent", () => {
    const a = must(submitSection(started(), "listening", T0 + MIN));
    expect(must(submitSection(a, "listening", T0 + 2 * MIN))).toEqual(a);
    const r = saveAnswer(a, "listening", "L1", { choice: "A" }, T0 + 2 * MIN);
    expect(!r.ok && r.error).toBe("section_closed");
  });
  it("an expired section lets the next one start", () => {
    const a = must(startSection(started(), "reading", T0 + 26 * MIN));
    expect(a.sections.listening.status).toBe("expired");
    expect(a.sections.reading.deadlineAt).toBe(T0 + 26 * MIN + SECTION_MINUTES.reading * MIN);
  });

  const allSubmitted = () => {
    let a = createAttempt("a1", "set");
    let t = T0;
    for (const skill of SKILLS) {
      a = must(startSection(a, skill, t));
      a = must(submitSection(a, skill, (t += MIN)));
    }
    return { a, t };
  };

  it("cannot submit the attempt while a section is open", () => {
    expect(submitAttempt(started(), T0 + MIN).ok).toBe(false);
  });
  it("active -> submitted -> evaluating -> completed, with pass computed per skill", () => {
    const { a, t } = allSubmitted();
    expect(currentSkill(a)).toBeNull();
    const submitted = must(submitAttempt(a, t));
    expect(must(submitAttempt(submitted, t + MIN))).toEqual(submitted);
    const done = must(finishEvaluation(must(beginEvaluation(submitted)), { listening: 15, reading: 15, writing: 8, speaking: 15 }, t));
    expect(done).toMatchObject({ status: "completed", totalScore: 53, passed: false });
  });
  it("a missing AI score gives needs_review with no pass flag", () => {
    const { a, t } = allSubmitted();
    const evaluating = must(beginEvaluation(must(submitAttempt(a, t))));
    const pending = must(finishEvaluation(evaluating, { listening: 12, reading: 11, writing: null, speaking: 10 }, t));
    expect(pending).toMatchObject({ status: "needs_review", totalScore: null, passed: null });
    // retry after review
    const done = must(finishEvaluation(must(beginEvaluation(pending)), { listening: 12, reading: 11, writing: 9, speaking: 10 }, t));
    expect(done).toMatchObject({ status: "completed", totalScore: 42, passed: true });
  });
  it("a provider failure leaves answers frozen and the attempt retryable", () => {
    const { a, t } = allSubmitted();
    const evaluating = must(beginEvaluation(must(submitAttempt(a, t))));
    const failed = must(failEvaluation(evaluating));
    expect(failed.status).toBe("failed");
    expect(failed.answers).toBe(evaluating.answers);
    expect(beginEvaluation(failed).ok).toBe(true);
  });
  it("cannot finish an evaluation that never began", () => {
    const { a, t } = allSubmitted();
    expect(finishEvaluation(a, { listening: 9, reading: 9, writing: 9, speaking: 9 }, t).ok).toBe(false);
  });
});
