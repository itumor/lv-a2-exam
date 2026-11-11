import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { FeedbackView } from "@/components/results/FeedbackView";
import { TopNav } from "@/components/ui/Nav";
import { getDashboardView, getFeedbackView } from "@/lib/server/attempts";

export const metadata: Metadata = { title: "Writing feedback" };

export default async function WritingFeedbackPage({ params }: PageProps<"/exam/[id]/results/writing/[task]">) {
  const { id, task } = await params;
  await connection(); // per-request data: never prerender
  const view = /^[123]$/.test(task) ? getFeedbackView(id, Number(task)) : null;
  if (!view) notFound();
  return (
    <>
      <TopNav active="results" streakDays={getDashboardView().streakDays} />
      <FeedbackView view={view} />
    </>
  );
}
