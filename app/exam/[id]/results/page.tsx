import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { ChunkyButton } from "@/components/ui/ChunkyButton";
import { CloseIcon } from "@/components/ui/icons";
import { IconLink } from "@/components/ui/IconLink";
import { TopNav } from "@/components/ui/Nav";
import { PracticeBanner } from "@/components/ui/PracticeBanner";
import { PassMarker, ScoreBar } from "@/components/ui/ScoreBar";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { PASS_MIN, SECTION_MAX, SKILLS } from "@/lib/exam-engine/rules";
import { getDashboardView, getResultsView, getRunnerView } from "@/lib/server/attempts";
import { cx, SKILL_UI } from "@/lib/ui/skill";
import { resultWords } from "@/lib/ui/result-words";

export const metadata: Metadata = { title: "Results" };

export default async function ResultsPage({ params }: PageProps<"/exam/[id]/results">) {
  const { id } = await params;
  await connection(); // per-request data: never prerender
  const view = getResultsView(id);
  if (!view) {
    // No results before all four parts are submitted.
    if (getRunnerView(id)) redirect(`/exam/${id}`);
    notFound();
  }
  const words = resultWords(view.outcome);
  const hasWriting = view.writingTasks.length > 0;

  const practiseNext = view.practiseNext && (
    <div className="rounded-[20px] bg-primary px-4 py-3.5 text-white lg:px-[18px] lg:py-4">
      <div className="text-xs font-black tracking-[0.06em] text-on-primary-soft uppercase">Practise next</div>
      <div className="mt-0.5 text-base leading-[1.3] font-black lg:text-lg">{view.practiseNext}</div>
    </div>
  );
  const actions = hasWriting && (
    <>
      <ChunkyButton href={`/exam/${id}/results/writing/3`} variant="accent" className="lg:px-7">
        See writing corrections
      </ChunkyButton>
      <Link href="/coming-soon" className="flex h-11 items-center justify-center text-[15px] font-black no-underline lg:underline">
        Retake writing only
      </Link>
    </>
  );

  return (
    <>
      <TopNav active="results" streakDays={getDashboardView().streakDays} />
      <main className="gutter mx-auto flex w-full max-w-[1120px] flex-col gap-3 pt-5 pb-4 lg:gap-6 lg:pt-9 lg:pb-12">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <h1 className="m-0 text-[22px] font-black lg:text-[32px] lg:leading-[1.15]">{view.title} results</h1>
          <IconLink href="/dashboard" label="Close results" className="lg:hidden">
            <CloseIcon size={20} />
          </IconLink>
          <PracticeBanner className="w-full lg:w-auto" />
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:gap-6">
          <Card as="section" chunky className="flex min-w-0 flex-col gap-5 rounded-card-lg p-[18px] lg:flex-[2_1_340px] lg:rounded-hero lg:p-7">
            <div className="flex items-center gap-4 lg:gap-5">
              <ScoreRing total={words.total} tone={words.tone} />
              <div>
                <div className={cx("text-[22px] leading-[1.15] font-black lg:text-[28px]", words.textClass)}>{words.heading}</div>
                {words.percent && <div className="mt-1 hidden text-[15px] font-extrabold text-muted lg:block">{words.percent} overall</div>}
                <p className="mt-1.5 mb-0 text-sm leading-[1.4] text-muted lg:hidden">{words.mobile}</p>
              </div>
            </div>
            <p className="m-0 hidden text-base leading-normal text-ink-soft lg:block">{words.desktop}</p>
            <div className="hidden lg:block">{practiseNext}</div>
            <div className="mt-auto hidden flex-wrap items-center gap-x-5 gap-y-2 lg:flex">{actions}</div>
          </Card>

          <div className="flex min-w-0 flex-col gap-2 lg:flex-[3_1_420px] lg:gap-3">
            {SKILLS.map((skill) => (
              <ScoreBar key={skill} label={SKILL_UI[skill].en} score={view.scores[skill]}>
                {skill === "writing" && hasWriting && (
                  <div className="hidden text-sm text-ink-soft lg:block">
                    {view.writingTasks.map((t) => `Task ${t.task}: ${t.score ?? "pending"} of ${t.max}`).join(" · ")}
                  </div>
                )}
              </ScoreBar>
            ))}
            <div className="flex items-center gap-2 text-[13px] font-extrabold text-muted lg:text-sm">
              <PassMarker className="h-3.5 lg:h-4" />
              The line marks the pass minimum, {PASS_MIN} of {SECTION_MAX}.
            </div>
          </div>
        </div>
        <div className="lg:hidden">{practiseNext}</div>
      </main>
      {actions && <footer className="mt-auto flex flex-col gap-2.5 border-t-2 border-line bg-surface px-5 pt-3.5 pb-6 lg:hidden">{actions}</footer>}
    </>
  );
}
