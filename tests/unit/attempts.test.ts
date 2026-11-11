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
  it("a full store never evicts a running exam; it makes room only from finished ones", async () => {
    const T = T0 + 24 * 60 * MIN; // later than every attempt above, so those have expired
    const running: string[] = [];
    for (let id = startExam(T); id; id = startExam(T)) running.push(id);
    expect(running.length).toBeGreaterThan(0);
    expect(running.length).toBeLessThanOrEqual(MAX_ATTEMPTS);
    expect(startExam(T)).toBeNull();
    for (const id of running) expect(getRunnerView(id, T)).toMatchObject({ state: "running" });
    for (const skill of SKILLS) await advance(running[0], skill, T + MIN);
    const fresh = startExam(T + 2 * MIN);
    expect(fresh).not.toBeNull();
    expect(getRunnerView(running[0], T + 2 * MIN)).toBeNull();
    expect(getRunnerView(running[1], T + 2 * MIN)).toMatchObject({ state: "running" });
  });
});
