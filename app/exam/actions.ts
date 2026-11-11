"use server";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { SKILLS, type Skill } from "@/lib/exam-engine/rules";
import { advance, saveAnswerFor, startExam, type SaveResult } from "@/lib/server/attempts";

// Server Functions are public endpoints: every argument is untrusted.
// ponytail: no ownership check yet. Add it with Supabase Auth (spec: owner-only attempts).

export async function startExamAction(): Promise<never> {
  redirect(`/exam/${startExam()}`);
}

export async function saveAnswerAction(attemptId: unknown, itemId: unknown, payload: unknown): Promise<SaveResult> {
  if (typeof attemptId !== "string" || typeof itemId !== "string") return { ok: false, error: "invalid_answer" };
  return saveAnswerFor(attemptId, itemId, payload);
}

/** Submit the current section; start the next one or finish the exam. */
export async function advanceAction(attemptId: unknown, fromSkill: unknown): Promise<void> {
  if (typeof attemptId !== "string" || !SKILLS.includes(fromSkill as Skill)) return;
  const result = await advance(attemptId, fromSkill as Skill);
  if (result?.done) redirect(`/exam/${attemptId}/results`);
  refresh();
}
