import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { startExamAction } from "@/app/exam/actions";
import { Card } from "@/components/ui/Card";
import { ChunkyButton } from "@/components/ui/ChunkyButton";
import { SKILL_ICON } from "@/components/ui/icons";
import { BottomNav, Brand, Streak, TopNav } from "@/components/ui/Nav";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { PASS_MIN, SECTION_MAX, SKILLS, TOTAL_MAX } from "@/lib/exam-engine/rules";
import { getDashboardView } from "@/lib/server/attempts";
import { cx, SKILL_UI } from "@/lib/ui/skill";
import { resultWords } from "@/lib/ui/result-words";

export const metadata: Metadata = { title: "Home" };

export default async function DashboardPage() {
  await connection();
  const { userName, streakDays, nextExamTitle, last } = getDashboardView();
  const words = last && resultWords(last.outcome);

  return (
    <>
      <TopNav active="home" streakDays={streakDays} />
      <header className="flex items-center justify-between px-5 pt-5 pb-2 lg:hidden">
        <Brand />
        <Streak days={streakDays} />
      </header>
      <main className="gutter mx-auto flex w-full max-w-[1120px] flex-col gap-4 pt-2 pb-6 lg:gap-7 lg:pt-9 lg:pb-12">
        <div>
          <h1 className="m-0 text-[26px] leading-[1.15] font-black lg:text-[34px]">Sveiki, {userName}!</h1>
          <p className="mt-1 mb-0 text-[15px] text-muted lg:mt-1.5 lg:text-[17px]">Your path to the A2 state language exam</p>
        </div>

        <div className="flex flex-wrap gap-6">
          <section className="flex min-w-0 flex-[2_1_420px] flex-col gap-3.5 rounded-card-lg border-b-[6px] border-primary-shadow bg-primary p-5 text-white lg:gap-4 lg:rounded-hero lg:p-7">
            <div className="flex items-start justify-between gap-3 lg:gap-4">
              <div>
                <div className="text-[13px] font-extrabold tracking-[0.06em] text-on-primary-soft uppercase">{nextExamTitle}</div>
                <div className="mt-1 text-[22px] leading-[1.2] font-black lg:text-[30px]">All 4 parts, exam timing</div>
              </div>
              <div className="rounded-control bg-white px-2.5 py-2 text-center text-lg leading-none font-black text-primary-text-hover lg:rounded-button lg:px-3.5 lg:py-2.5 lg:text-2xl">
                {TOTAL_MAX}
                <div className="mt-[3px] text-[11px] font-extrabold lg:mt-1 lg:text-xs">points</div>
              </div>
            </div>
            <div className="text-sm text-on-primary-soft lg:text-base lg:leading-[1.45]">
              About 1 h 45 min. You pass with {PASS_MIN} of {SECTION_MAX} in every part.
              <span className="hidden lg:inline"> Check your microphone and headphones before you start.</span>
            </div>
            <form action={startExamAction} className="lg:self-start">
              <ChunkyButton type="submit" variant="accent" className="w-full lg:h-[54px] lg:px-10 lg:text-lg">
                Start exam
              </ChunkyButton>
            </form>
          </section>

          {last && words && (
            <Card as="section" chunky className="hidden min-w-0 flex-[1_1_280px] flex-col gap-3 rounded-hero p-6 lg:flex">
              <div className="text-[13px] font-extrabold tracking-[0.06em] text-muted uppercase">Last result · {last.title.toLowerCase()}</div>
              <div className="flex items-center gap-4">
                <ScoreRing size="sm" total={words.total} tone={words.tone} />
                <div>
                  <div className={cx("text-xl font-black", words.textClass)}>{words.heading}</div>
                  <div className="text-sm leading-[1.4] text-muted">{words.short}</div>
                </div>
              </div>
              <Link href={`/exam/${last.attemptId}/results`} className="mt-auto py-3 text-[15px] font-black">
                See full results
              </Link>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-2.5 lg:gap-3.5">
          <div className="flex items-baseline justify-between">
            <h2 className="m-0 text-[17px] font-black lg:text-xl">Practise one part</h2>
            <span className="text-[13px] font-extrabold text-muted lg:hidden">Last score</span>
          </div>
          <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:gap-4">
            {SKILLS.map((skill) => {
              const ui = SKILL_UI[skill];
              const Icon = SKILL_ICON[skill];
              const score = last?.scores[skill] ?? null;
              const ok = score !== null && score >= PASS_MIN;
              return (
                <Link
                  key={skill}
                  href="/coming-soon"
                  className="grid min-w-0 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-card border-2 border-b-4 border-line bg-surface px-3.5 py-2.5 text-ink no-underline hover:text-ink lg:flex-[1_1_200px] lg:grid-cols-[1fr_auto] lg:rounded-[22px] lg:border-b-[5px] lg:p-[18px]"
                >
                  <div className={cx("flex size-11 items-center justify-center rounded-control lg:size-12", ui.tint, ui.text)}>
                    <Icon className={ICON_COLOR[skill]} />
                  </div>
                  <div className="lg:col-span-2 lg:row-start-2">
                    <div lang="lv" className="text-base font-black lg:text-lg">{ui.lv}</div>
                    <div className="text-[13px] text-muted lg:text-sm">
                      {ui.en} · {ui.time}
                    </div>
                  </div>
                  {score !== null && (
                    <div className={cx("rounded-[10px] px-2.5 py-1.5 text-[15px] font-black lg:col-start-2 lg:row-start-1 lg:justify-self-end", ok ? "bg-pass-tint text-pass-text" : "bg-danger-tint text-danger")}>
                      {score}/{SECTION_MAX}
                      <span className="sr-only">{ok ? ", pass" : `, below ${PASS_MIN}`}</span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </main>
      <BottomNav active="home" />
    </>
  );
}

const ICON_COLOR = { listening: "text-listening", reading: "text-reading", writing: "text-writing", speaking: "text-speaking" };
