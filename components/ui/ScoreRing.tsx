import { TOTAL_MAX } from "@/lib/exam-engine/rules";
import { cx } from "@/lib/ui/skill";

const SIZE = {
  sm: { ring: "size-[84px] border-8", number: "text-2xl", caption: "text-xs" },
  lg: { ring: "size-24 border-8 lg:size-32 lg:border-[10px]", number: "text-[28px] lg:text-[40px]", caption: "text-xs lg:text-sm" },
};
const TONE = { pass: "border-pass", fail: "border-fail", pending: "border-track" };

/** Total out of 60. The tone only supports the words next to it. */
export function ScoreRing({ total, tone, size = "lg" }: { total: number | null; tone: keyof typeof TONE; size?: keyof typeof SIZE }) {
  const s = SIZE[size];
  return (
    <div className={cx("flex shrink-0 flex-col items-center justify-center rounded-full", s.ring, TONE[tone])}>
      <div className={cx("leading-none font-black", s.number)}>{total ?? "–"}</div>
      <div className={cx("font-extrabold text-muted", s.caption)}>of {TOTAL_MAX}</div>
    </div>
  );
}
