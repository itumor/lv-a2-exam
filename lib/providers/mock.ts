// Mock providers: no network, no API keys, no cost. Deterministic output.
import type { AiGrader, Grade, SpeechToText, TextToSpeech } from "./types";

export const MOCK_MODEL_ID = "mock-grader-v0";

export const mockGrader: AiGrader = {
  async grade({ rubricVersion, maxPoints, learnerText }) {
    const empty = learnerText.trim() === "";
    const grade: Grade = {
      points: empty ? 0 : Math.floor(maxPoints / 2),
      rubricVersion,
      modelId: MOCK_MODEL_ID,
      criterionEvidence: [],
      corrections: [],
      missing: [],
      uncertainty: empty ? "low" : "high",
      uncertaintyReason: empty ? "No answer was given." : "Mock grader: fixed half marks, not a real evaluation.",
      nextPractice: "this task type",
    };
    return grade;
  },
};

export const mockSpeechToText: SpeechToText = {
  async transcribe({ durationSec }) {
    return durationSec > 0
      ? { text: "[mock transcript]", provider: "mock-stt", status: "ok" }
      : { text: "", provider: "mock-stt", status: "empty" };
  },
};

export const mockTextToSpeech: TextToSpeech = {
  async synthesize({ voice }) {
    return { audio: new Uint8Array(), mimeType: "audio/mpeg", voice, provider: "mock-tts" };
  },
};
