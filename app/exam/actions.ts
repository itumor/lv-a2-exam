"use server";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { SKILLS, type Skill } from "@/lib/exam-engine/rules";
import { advance, saveAnswerFor, startExam, type SaveResult } from "@/lib/server/attempts";

// Server Functions are public endpoints: every argument is untrusted.
// ponytail: no session, ownership check or rate limit yet. All three come with
// Supabase Auth and the quota ledger (spec sections 4 and 6). Until then the
// in-memory store is capped and never evicts an attempt that is in progress.

export async function startExamAction(): Promise<never> {
  const id = startExam();
  redirect(id ? `/exam/${id}` : "/dashboard");
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
