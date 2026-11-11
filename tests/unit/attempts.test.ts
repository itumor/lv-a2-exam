import { describe, expect, it } from "vitest";
import { SKILLS } from "@/lib/exam-engine";
import { mockGrader, mockSpeechToText, mockTextToSpeech } from "@/lib/providers/mock";
import { parseGrade } from "@/lib/providers/types";
import { advance, getFeedbackView, getResultsView, getRunnerView, MAX_ATTEMPTS, saveAnswerFor, startExam } from "@/lib/server/attempts";

const T0 = Date.UTC(2026, 10, 11, 9, 0, 0);
const MIN = 60_000;
const L1Q2 = "A2-ORIGINAL-001-L1-Q2";
const R2Q1 = "A2-ORIGINAL-001-R2-Q1";

describe("mock providers", () => {
  it("grader output passes validation and is marked uncertain", async () => {
    const grade = parseGrade(await mockGrader.grade({ rubricVersion: "v", maxPoints: 6, prompt: "p", learnerText: "Sveiks!" }), 6);
    expect(grade).toMatchObject({ points: 3, uncertainty: "high" });
  });
  it("an empty answer gets 0", async () => {
    expect(parseGrade(await mockGrader.grade({ rubricVersion: "v", maxPoints: 6, prompt: "p", learnerText: " " }), 6).points).toBe(0);
  });
  it("9 points for a 6-point task is rejected", () => {
    const bad = { points: 9, rubricVersion: "v", modelId: "m", criterionEvidence: [], corrections: [], uncertainty: "low", uncertaintyReason: "", nextPractice: "" };
    expect(() => parseGrade(bad, 6)).toThrow(RangeError);
  });
  it("speech mocks make no claims: empty audio gives an empty transcript", async () => {
    expect((await mockSpeechToText.transcribe({ audio: null, durationSec: 0, language: "lv-LV" })).status).toBe("empty");
    expect((await mockTextToSpeech.synthesize({ textLv: "Labdien!", voice: "lv-LV-EveritaNeural" })).provider).toBe("mock-tts");
  });
});

describe("attempt store", () => {
  it("the runner view carries no answer keys or transcripts", () => {
    const json = JSON.stringify(getRunnerView(startExam(T0)!, T0));
    expect(json).not.toContain("answerKey");
    expect(json).not.toContain("transcriptLv");
  });
  it("derives the section from the item: a reading answer cannot be saved during listening", () => {
    const id = startExam(T0)!;
    expect(saveAnswerFor(id, L1Q2, { choice: "B" }, T0)).toEqual({ ok: true, revision: 1 });
    expect(saveAnswerFor(id, R2Q1, { choice: "C" }, T0)).toEqual({ ok: false, error: "section_closed" });
  });
  it("a closed section cannot be edited from a later one", async () => {
    const id = startExam(T0)!;
    await advance(id, "listening", T0 + MIN);
    expect(saveAnswerFor(id, L1Q2, { choice: "B" }, T0 + 2 * MIN)).toEqual({ ok: false, error: "section_closed" });
    expect(saveAnswerFor(id, R2Q1, { choice: "C" }, T0 + 2 * MIN)).toEqual({ ok: true, revision: 1 });
  });
  it("rejects malformed and unknown answers", () => {
    const id = startExam(T0)!;
    expect(saveAnswerFor(id, L1Q2, { choice: "Z" }, T0)).toEqual({ ok: false, error: "invalid_answer" });
    expect(saveAnswerFor(id, "nope", { choice: "A" }, T0)).toEqual({ ok: false, error: "invalid_answer" });
    expect(saveAnswerFor("nope", L1Q2, { choice: "A" }, T0)).toEqual({ ok: false, error: "not_found" });
  });
  it("rejects a late answer and shows the closed section until the learner continues", () => {
    const id = startExam(T0)!;
    expect(saveAnswerFor(id, L1Q2, { choice: "B" }, T0 + 25 * MIN)).toEqual({ ok: false, error: "deadline_passed" });
    expect(getRunnerView(id, T0 + 25 * MIN)).toMatchObject({ state: "section_closed", skill: "listening" });
  });
  it("gives no results before all four parts are submitted", async () => {
    const id = startExam(T0)!;
    await advance(id, "listening", T0 + MIN);
    expect(getResultsView(id)).toBeNull();
    expect(getFeedbackView(id, 3)).toBeNull();
  });
  it("scores a full run: keyed answers count, open tasks get the mock grade, advance is idempotent", async () => {
    const id = startExam(T0)!;
    let t = T0;
    saveAnswerFor(id, L1Q2, { choice: "B" }, t);
    for (const skill of SKILLS) {
      if (skill === "reading") saveAnswerFor(id, R2Q1, { choice: "C" }, t);
      if (skill === "writing") saveAnswerFor(id, "A2-ORIGINAL-001-W2-Q1", { text: "Vasarai" }, t);
      expect(await advance(id, skill, (t += MIN))).toEqual({ done: skill === "speaking" });
    }
    expect(await advance(id, "speaking", t + MIN)).toEqual({ done: true });
    const r = getResultsView(id)!;
    // listening 1, reading 1, writing 0 (empty) + 1 + 0, speaking 0: nothing recorded
    expect(r.scores).toEqual({ listening: 1, reading: 1, writing: 1, speaking: 0 });
    expect(r.outcome).toMatchObject({ status: "final", total: 3, passed: false });
    expect(getFeedbackView(id, 2)!.wordForms[0]).toMatchObject({ given: "Vasarai", accepted: "vasarai", correct: true });
    expect(getRunnerView(id)).toEqual({ state: "finished", attemptId: id });
  });
  it("serves the design sample: 40 of 60, not passed, writing 2 short", () => {
    const r = getResultsView("mock-exam-1")!;
    expect(r.scores).toEqual({ listening: 12, reading: 11, writing: 7, speaking: 10 });
    expect(r.outcome).toEqual({ status: "final", total: 40, passed: false, below: [{ skill: "writing", short: 2 }] });
    expect(getFeedbackView("mock-exam-1", 3)).toMatchObject({ score: 3, max: 6, grade: { points: 3 } });
  });
  it("a full store drops idle and stalled attempts, never an exam that is being answered", () => {
    const T = T0 + 24 * 60 * MIN; // every attempt above has run out of time by now
    const answering = Array.from({ length: MAX_ATTEMPTS - 1 }, () => { // the sample attempt holds one slot
      const id = startExam(T)!; // makes room by dropping finished, idle or stalled attempts
      expect(saveAnswerFor(id, L1Q2, { choice: "B" }, T)).toMatchObject({ ok: true });
      return id;
    });
    // full of exams in progress: refuse rather than drop one
    expect(startExam(T)).toBeNull();
    for (const id of answering) expect(getRunnerView(id, T)).toMatchObject({ state: "running" });

    // once the oldest has run out of time and stalled, it makes room
    const later = T + 26 * MIN;
    const fresh = startExam(later)!;
    expect(getRunnerView(answering[0], later)).toBeNull();
    expect(getRunnerView(answering[1], later)).toMatchObject({ state: "section_closed" });

    // an attempt that has only just started is protected too, even without answers...
    const idle = startExam(later)!; // the next stalled one makes room for it
    expect(getRunnerView(answering[1], later)).toBeNull();
    for (let id = startExam(later); id; id = startExam(later)); // use up every stalled slot
    expect(startExam(later + 4 * MIN)).toBeNull();
    expect(getRunnerView(idle, later + 4 * MIN)).toMatchObject({ state: "running" });
    // ...but after the grace period an unanswered attempt gives way
    expect(startExam(later + 6 * MIN)).not.toBeNull();
    expect(getRunnerView(fresh, later + 6 * MIN)).toBeNull();
  });
});
