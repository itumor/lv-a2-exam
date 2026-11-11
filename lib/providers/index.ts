import { mockGrader, mockSpeechToText, mockTextToSpeech } from "./mock";
import type { AiGrader, SpeechToText, TextToSpeech } from "./types";

export type Providers = { grader: AiGrader; speechToText: SpeechToText; textToSpeech: TextToSpeech };

// ponytail: mocks only. Select real adapters here (by env) when they exist.
export const providers: Providers = { grader: mockGrader, speechToText: mockSpeechToText, textToSpeech: mockTextToSpeech };

export * from "./types";
