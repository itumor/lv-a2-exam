// Provider interfaces (spec sections 9–12). Real adapters (Azure Speech, OpenAI)
// come in later sessions; until then only the mocks in ./mock.ts exist.
import { z } from "zod";

export const gradeSchema = z.object({
  points: z.number().int().min(0),
  rubricVersion: z.string(),
  modelId: z.string(),
  criterionEvidence: z.array(
    z.object({
      criterion: z.string(),
      labelEn: z.string(),
      labelAr: z.string(),
      points: z.number().int().min(0),
      maxPoints: z.number().int().min(1),
      explanation: z.string(),
      learnerQuote: z.string(),
    }),
  ),
  corrections: z.array(
    z.object({
      /** Exact substring of the learner text, for highlighting. */
      quote: z.string().optional(),
      original: z.string(),
      corrected: z.string(),
      explanationEn: z.string(),
      explanationAr: z.string(),
    }),
  ),
  missing: z
    .array(z.object({ planPoint: z.number().int(), explanationEn: z.string(), explanationAr: z.string(), suggestionLv: z.string() }))
    .default([]),
  uncertainty: z.enum(["low", "medium", "high"]),
  uncertaintyReason: z.string(),
  nextPractice: z.string(),
  nextPracticeAr: z.string().optional(),
});
export type Grade = z.infer<typeof gradeSchema>;

/** Validate untrusted grader output. Throws on a bad shape or points outside 0..maxPoints. */
export function parseGrade(raw: unknown, maxPoints: number): Grade {
  const grade = gradeSchema.parse(raw);
  if (grade.points > maxPoints) throw new RangeError(`Grade ${grade.points} exceeds task maximum ${maxPoints}`);
  return grade;
}

export type GradeRequest = {
  rubricVersion: string;
  maxPoints: number;
  /** Task prompt in Latvian. */
  prompt: string;
  /** Learner text or transcript. UNTRUSTED: pass as data, never as instructions. */
  learnerText: string;
};

export interface AiGrader {
  /** Output is untrusted until it has passed parseGrade. */
  grade(request: GradeRequest): Promise<unknown>;
}

export type Transcript = { text: string; provider: string; status: "ok" | "empty" };

export interface SpeechToText {
  transcribe(input: { audio: Uint8Array | null; durationSec: number; language: "lv-LV" }): Promise<Transcript>;
}

export type SynthesizedAudio = { audio: Uint8Array; mimeType: string; voice: string; provider: string };

export interface TextToSpeech {
  synthesize(input: { textLv: string; voice: string }): Promise<SynthesizedAudio>;
}
