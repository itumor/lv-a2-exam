import { describe, expect, it } from "vitest";
import raw from "@/content/exam-sets/a2-original-001.json";
import { buildSteps, toPublicSection } from "@/lib/content/public";
import { validateManifest, type MediaProbe } from "@/lib/content/validate";
import { SKILLS } from "@/lib/exam-engine/rules";

const SHA = "b5bab7e5e1fd7ffbb2a0424910a65575dc1528df36660aa64e85700a22b5e401";
const probe: MediaProbe = () => ({ exists: true, sha256: SHA });
const clone = () => structuredClone(raw) as typeof raw;
const errorsOf = (m: unknown) => validateManifest(m, probe).errors;

describe("bundled exam set", () => {
  const report = validateManifest(raw, probe);

  it("is valid, and still a draft nobody has reviewed", () => {
    expect(report.errors).toEqual([]);
    expect(report.manifest).toMatchObject({ status: "draft", reviewed_by: null });
    expect(report.warnings.length).toBeGreaterThan(0);
  });
  it("cannot be published as it is", () => {
    const errors = errorsOf({ ...clone(), status: "published" });
    expect(errors.some((e) => e.includes("reviewed_by"))).toBe(true);
    expect(errors.some((e) => e.includes("placeholder"))).toBe(true);
  });
  it("never sends answer keys or audio transcripts to the client", () => {
    for (const skill of SKILLS) {
      const json = JSON.stringify(toPublicSection(report.manifest!, skill));
      expect(json).not.toContain("answerKey");
      expect(json).not.toContain("transcriptLv");
      expect(json).not.toContain("Koncerts sāksies pulksten 19.00");
    }
  });
  it("builds the runner screens in the official task format", () => {
    const count = (skill: (typeof SKILLS)[number]) => buildSteps(toPublicSection(report.manifest!, skill)).length;
    expect(count("listening")).toBe(6 + 1 + 5);
    expect(count("reading")).toBe(4 + 6 + 1);
    expect(count("writing")).toBe(1 + 1 + 1);
    expect(count("speaking")).toBe(10 + 2 + 3);
  });
});

describe("point structure", () => {
  it("rejects a section that is not exactly 15 points", () => {
    const m = clone();
    m.sections.listening[0].maxPoints = 2;
    expect(errorsOf(m)).toEqual(expect.arrayContaining([expect.stringContaining("listening: 16 points")]));
  });
  it("rejects writing that is not 4+5+6", () => {
    const m = clone();
    m.sections.writing[0].maxPoints = 5;
    m.sections.writing[6].maxPoints = 5;
    expect(errorsOf(m)).toEqual(expect.arrayContaining(["writing task 1: 5 points, must be 4", "writing task 3: 5 points, must be 6"]));
  });
  it("rejects speaking that is not 12+3", () => {
    const m = clone();
    m.sections.speaking[0].maxPoints = 5;
    m.sections.speaking[2].maxPoints = 4;
    expect(errorsOf(m)).toEqual(expect.arrayContaining([expect.stringContaining("speaking tasks 1+2: 11 points")]));
  });
  it("needs 9–10 interview questions, 2 pictures, 3 adverts", () => {
    const m = clone();
    m.sections.speaking[0].prompt.questionsLv!.length = 8;
    m.sections.speaking[1].media.length = 1;
    m.sections.speaking[2].prompt.advertsLv!.length = 2;
    const errors = errorsOf(m);
    expect(errors).toEqual(expect.arrayContaining([
      "speaking task 1: 8 interview questions, must be 9–10",
      "speaking task 2: exactly 2 picture stimuli",
      "speaking task 3: exactly 3 adverts",
    ]));
  });
  it("rejects duplicate ids, a key outside the options, and a wrong media hash", () => {
    const m = clone();
    m.sections.listening[1].externalId = m.sections.listening[0].externalId;
    m.sections.reading[4].answerKey = { correct: "E" };
    const errors = validateManifest(m, () => ({ exists: true, sha256: "other" })).errors;
    expect(errors.some((e) => e.startsWith("duplicate externalId"))).toBe(true);
    expect(errors.some((e) => e.includes('key "E" is not one of the options'))).toBe(true);
    expect(errors.some((e) => e.includes("sha256 does not match"))).toBe(true);
  });
  it("rejects an image without a description and a missing media file", () => {
    const m = clone();
    delete (m.sections.speaking[1].media[1] as { descriptionLv?: string }).descriptionLv;
    const errors = validateManifest(m, () => ({ exists: false })).errors;
    expect(errors.some((e) => e.includes("has no description"))).toBe(true);
    expect(errors.some((e) => e.includes("does not exist"))).toBe(true);
  });
});
