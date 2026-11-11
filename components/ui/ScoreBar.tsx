import type { ReactNode } from "react";
import { PASS_MIN, SECTION_MAX } from "@/lib/exam-engine/rules";
import { cx } from "@/lib/ui/skill";

/** Vertical ink line at 9 of 15 (60%). */
export function PassMarker({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx("w-[3px] rounded-sm bg-ink", className)} />;
}

/** One skill score. Pass or fail is always written in words, never shown by colour alone. */
export function ScoreBar({ label, score, children }: { label: string; score: number | null; children?: ReactNode }) {
  const pending = score === null;
  const ok = !pending && score >= PASS_MIN;
  const fail = !pending && !ok;
  return (
    <div className={cx("flex flex-col gap-1.5 rounded-button border-2 px-3.5 py-2.5 lg:gap-2.5 lg:rounded-[20px] lg:px-5 lg:py-4", fail ? "border-fail bg-fail-tint" : "border-line bg-surface")}>
      <div className="flex items-baseline justify-between font-black">
        <span className="text-[15px] lg:text-lg">{label}</span>
        <span className={cx("text-[15px] lg:text-[17px]", pending ? "text-muted" : ok ? "text-pass-text" : "text-fail-text")}>
          {pending ? "Pending" : `${score}/${SECTION_MAX} · ${ok ? "Pass" : `Below ${PASS_MIN}`}`}
        </span>
      </div>
      <div className={cx("relative h-2.5 rounded-full lg:h-3", fail ? "bg-surface" : "bg-track-soft")}>
        <div className={cx("h-full rounded-full", ok ? "bg-pass" : "bg-fail")} style={{ width: `${((score ?? 0) / SECTION_MAX) * 100}%` }} />
        <PassMarker className="absolute -top-[3px] left-[60%] h-4 lg:-top-1 lg:h-5" />
      </div>
      {children}
    </div>
  );
}
