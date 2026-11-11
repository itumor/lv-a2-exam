import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { ExamRunner } from "@/components/exam/ExamRunner";
import { getRunnerView } from "@/lib/server/attempts";

export const metadata: Metadata = { title: "Eksāmens" };

export default async function ExamPage({ params }: PageProps<"/exam/[id]">) {
  const { id } = await params;
  await connection(); // per-request data: never prerender
  const view = getRunnerView(id);
  if (!view) notFound();
  if (view.state === "finished") redirect(`/exam/${id}/results`);
  // The key remounts the runner when the next section starts.
  return <ExamRunner key={view.skill} view={view} />;
}
