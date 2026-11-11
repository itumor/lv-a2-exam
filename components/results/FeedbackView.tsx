"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { countWords } from "@/components/exam/WritingEditor";
import { Card } from "@/components/ui/Card";
import { ChunkyButton } from "@/components/ui/ChunkyButton";
import { BackIcon } from "@/components/ui/icons";
import { IconLink } from "@/components/ui/IconLink";
import type { FeedbackView as View } from "@/lib/server/attempts";
import { cx } from "@/lib/ui/skill";

type Lang = "en" | "ar";

// Explanations are available in English and Arabic. The exam content itself stays Latvian.
const T = {
  en: {
    title: (n: number) => `Writing, task ${n}`,
    explainIn: "Explain in",
    yourText: "Your text",
    yourEmail: "Your e-mail",
    words: (n: number, target: number | null) => `${n} words${target ? ` · target about ${target}` : ""}`,
    taskScore: "Task score",
    corrections: "Corrections",
    none: "No corrections for this task.",
    noAnswer: "No answer",
    missing: (n: number) => `Missing plan point ${n}`,
    confidence: { low: "AI estimate, confidence: high", medium: "AI estimate, confidence: medium", high: "AI estimate, confidence: low" },
    keyed: "Checked against the answer key",
    review: "Ask a teacher to review",
    practise: (tag: string) => `Practise ${tag}`,
  },
  ar: {
    title: (n: number) => `الكتابة، المهمة ${n}`,
    explainIn: "لغة الشرح",
    yourText: "نصّك",
    yourEmail: "رسالتك",
    words: (n: number, target: number | null) => `${n} كلمة${target ? ` · المطلوب نحو ${target}` : ""}`,
    taskScore: "درجة المهمة",
    corrections: "التصحيحات",
    none: "لا توجد تصحيحات لهذه المهمة.",
    noAnswer: "لا توجد إجابة",
    missing: (n: number) => `نقطة الخطة ${n} ناقصة`,
    confidence: { low: "تقدير بالذكاء الاصطناعي، مستوى الثقة: مرتفع", medium: "تقدير بالذكاء الاصطناعي، مستوى الثقة: متوسط", high: "تقدير بالذكاء الاصطناعي، مستوى الثقة: منخفض" },
    keyed: "تم التحقق وفق مفتاح الإجابات",
    review: "اطلب مراجعة من معلّم",
    practise: (tag: string) => `تدرّب على ${tag}`,
  },
};

/** Wrap each quoted error in <mark>. Quotes come from the grader; unmatched ones are skipped. */
function highlight(text: string, quotes: string[]): ReactNode[] {
  const found = quotes.filter((q) => q && text.includes(q));
  if (found.length === 0) return [text];
  const parts: ReactNode[] = [];
  let rest = text;
  while (rest) {
    const hits = found.map((q) => ({ q, at: rest.indexOf(q) })).filter((h) => h.at >= 0).sort((a, b) => a.at - b.at);
    if (hits.length === 0) break;
    const { q, at } = hits[0];
    parts.push(rest.slice(0, at), <mark key={parts.length} className="rounded-md bg-fail-tint px-1 py-0.5 font-black text-fail-text underline">{q}</mark>);
    rest = rest.slice(at + q.length);
  }
  return [...parts, rest];
}

export function FeedbackView({ view }: { view: View }) {
  const [lang, setLang] = useState<Lang>("en");
  const t = T[lang];
  const ar = lang === "ar";
  const grade = view.grade;
  const back = `/exam/${view.attemptId}/results`;
  const scoreText = `${view.score ?? "–"}/${view.max}`;
  const corrections = grade
    ? grade.corrections.map((c) => ({ original: c.original, corrected: c.corrected, explanation: ar ? c.explanationAr : c.explanationEn }))
    : view.wordForms.filter((w) => !w.correct).map((w) => ({ original: w.given || t.noAnswer, corrected: w.promptLv.replace("___", w.accepted), explanation: "" }));
  const practiseTag = grade && (ar ? (grade.nextPracticeAr ?? grade.nextPractice) : grade.nextPractice);

  const confidence = (
    <>
      <span>{grade ? t.confidence[grade.uncertainty] : t.keyed}</span>
      <Link href="/coming-soon" className="inline-flex min-h-11 items-center font-black underline">
        {t.review}
      </Link>
    </>
  );
  const practise = practiseTag && <ChunkyButton href="/coming-soon" className="lg:self-start lg:px-7">{t.practise(practiseTag)}</ChunkyButton>;

  return (
    <>
      <main className="gutter mx-auto flex w-full max-w-[1120px] flex-col gap-3 pt-5 pb-4 lg:gap-6 lg:pt-8 lg:pb-12">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3 lg:gap-4">
          <IconLink href={back} label="Back to results">
            <BackIcon size={20} />
          </IconLink>
          <div className="grow" dir={ar ? "rtl" : "ltr"}>
            <h1 className="m-0 text-xl leading-[1.2] font-black lg:text-[30px] lg:leading-[1.15]">{t.title(view.task)}</h1>
            <div className="text-[13px] font-extrabold text-muted lg:text-[15px]" dir="ltr">
              {view.subtitle}
              <span className="hidden lg:inline"> · {view.examTitle.toLowerCase()}</span>
            </div>
          </div>
          <div className="rounded-control bg-fail-tint px-3 py-2 text-lg font-black text-fail-text lg:hidden">{scoreText}</div>
          <div className="flex w-full items-center justify-between gap-3 lg:w-auto">
            <div className="text-[13px] font-extrabold text-muted lg:text-sm">{t.explainIn}</div>
            <div role="group" aria-label="Explanation language" className="grid w-[200px] grid-cols-2 gap-1 rounded-control bg-track-soft p-1 lg:w-[210px]">
              {(["en", "ar"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={lang === l}
                  onClick={() => setLang(l)}
                  lang={l}
                  className={cx("h-11 cursor-pointer rounded-[10px] border-0 text-sm lg:text-[15px]", lang === l ? "bg-surface font-black text-ink" : "bg-transparent font-extrabold text-ink-soft")}
                >
                  {l === "en" ? "English" : "العربية"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Arabic explanations render right-to-left; Latvian text inside stays left-to-right. */}
        <div dir={ar ? "rtl" : "ltr"} lang={lang} className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:gap-7">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-[1_1_380px] lg:gap-4">
            {view.learnerText && (
              <Card as="section" chunky className="hidden rounded-card-lg p-6 lg:block">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="m-0 text-lg font-black">{view.task === 3 ? t.yourEmail : t.yourText}</h2>
                  <span className="text-sm font-extrabold text-fail-text">{t.words(countWords(view.learnerText), view.targetWords)}</span>
                </div>
                <p lang="lv" dir="ltr" className="mt-3.5 mb-0 text-xl leading-[1.7] whitespace-pre-line">
                  {highlight(view.learnerText, grade?.corrections.map((c) => c.quote ?? "") ?? [])}
                </p>
              </Card>
            )}
            {grade && grade.criterionEvidence.length > 0 && (
              <div className="grid grid-cols-3 gap-2 lg:grid-cols-4 lg:gap-2.5">
                <div className="hidden rounded-button bg-fail-tint p-3 text-center lg:block">
                  <div className="text-[22px] font-black text-fail-text">{scoreText}</div>
                  <div className="text-[13px] font-extrabold text-ink-soft">{t.taskScore}</div>
                </div>
                {grade.criterionEvidence.map((c) => (
                  <Card key={c.criterion} className="rounded-control p-2.5 text-center lg:rounded-button lg:p-3">
                    <div className="text-lg font-black lg:text-[22px]">
                      {c.points}/{c.maxPoints}
                    </div>
                    <div className="text-xs font-extrabold text-muted lg:text-[13px]">{ar ? c.labelAr : c.labelEn}</div>
                  </Card>
                ))}
              </div>
            )}
            <div className="hidden flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm font-extrabold text-muted lg:flex">{confidence}</div>
          </div>

          <div className="flex min-w-0 flex-col gap-3 lg:flex-[1_1_380px] lg:gap-3.5">
            <h2 className="mt-1 mb-0 text-base font-black lg:mt-0 lg:text-lg">{t.corrections}</h2>
            {corrections.length === 0 && !grade?.missing.length && <p className="m-0 text-sm text-muted">{t.none}</p>}
            {corrections.map((c) => (
              <Card as="article" key={c.original + c.corrected} className="flex flex-col gap-1.5 px-3.5 py-3 lg:rounded-[20px] lg:px-5 lg:py-4">
                <div lang="lv" dir="ltr" className="text-base font-extrabold text-fail-text line-through rtl:text-right lg:text-[17px]">
                  <span className="sr-only">Wrong: </span>
                  {c.original}
                </div>
                <div lang="lv" dir="ltr" className="text-[17px] font-black text-pass-text rtl:text-right lg:text-[19px]">
                  <span className="sr-only">Correct: </span>
                  {c.corrected}
                </div>
                {c.explanation && <p className="m-0 text-sm leading-[1.4] text-ink-soft lg:text-[15px] lg:leading-[1.45]">{c.explanation}</p>}
              </Card>
            ))}
            {grade?.missing.map((m) => (
              <article key={m.planPoint} className="flex flex-col gap-1 rounded-card bg-accent-tint px-3.5 py-3 lg:rounded-[20px] lg:px-5 lg:py-4">
                <div className="text-xs font-black tracking-[0.06em] text-accent-text uppercase">{t.missing(m.planPoint)}</div>
                <p className="m-0 text-sm leading-[1.4] text-ink lg:text-[15px] lg:leading-[1.45]">
                  {ar ? m.explanationAr : m.explanationEn}{" "}
                  <bdi lang="lv" className="font-black">
                    {m.suggestionLv}
                  </bdi>
                </p>
              </article>
            ))}
            <div className="flex items-center justify-between gap-3 text-[13px] font-extrabold text-muted lg:hidden">{confidence}</div>
            <div className="hidden lg:flex">{practise}</div>
          </div>
        </div>
      </main>
      {practise && <footer className="mt-auto border-t-2 border-line bg-surface px-5 pt-3.5 pb-6 lg:hidden">{practise}</footer>}
    </>
  );
}
