import { PASS_MIN, SECTION_MAX, TOTAL_MAX, type Outcome } from "@/lib/exam-engine/rules";
import { SKILL_UI } from "./skill";

const plural = (n: number) => `${n} point${n === 1 ? "" : "s"}`;

/** Wording for a result. Pass, fail and pending are always said in words. */
export function resultWords(o: Outcome) {
  if (o.status === "pending") {
    return {
      total: null,
      tone: "pending" as const,
      textClass: "text-ink",
      heading: "Result pending",
      percent: null,
      short: "Some answers are still being evaluated.",
      mobile: "Some answers are still being evaluated. No pass or fail is shown until all four parts have a score.",
      desktop: "Some answers are still being evaluated. No pass or fail is shown until all four parts have a score.",
    };
  }
  const percent = `${((o.total / TOTAL_MAX) * 100).toFixed(1)}%`;
  if (o.passed) {
    const text = `Every part is at least ${PASS_MIN} of ${SECTION_MAX}. This is a practice estimate, not an exam result.`;
    return { total: o.total, tone: "pass" as const, textClass: "text-pass-text", heading: "Pass level reached", percent, short: text, mobile: text, desktop: text };
  }
  const list = o.below.map((b) => `${SKILL_UI[b.skill].en} is ${plural(b.short)} short`).join(", ");
  const rule = `every part needs at least ${PASS_MIN} of ${SECTION_MAX}`;
  const above = o.total / TOTAL_MAX >= PASS_MIN / SECTION_MAX;
  return {
    total: o.total,
    tone: "fail" as const,
    textClass: "text-fail-text",
    heading: "Not passed yet",
    percent,
    short: `${list} of ${PASS_MIN}.`,
    mobile: above ? `Your total is ${percent}, but ${rule}. ${list}.` : `Your total is ${percent} and ${rule}. ${list}.`,
    desktop: above
      ? `Your total is above 60%, but ${rule}. ${list}, so a strong score elsewhere cannot cover it.`
      : `Your total is ${percent} and ${rule}. ${list}.`,
  };
}
