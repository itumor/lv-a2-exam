import { PRACTICE_BANNER } from "@/lib/config";
import { cx } from "@/lib/ui/skill";
import { InfoIcon } from "./icons";

/** Required on every scorecard. */
export function PracticeBanner({ className }: { className?: string }) {
  return (
    <div role="note" className={cx("flex items-center gap-2.5 rounded-control bg-accent-tint px-3 py-2.5 text-[13px] leading-[1.35] font-extrabold text-accent-text lg:px-3.5 lg:text-sm", className)}>
      <InfoIcon size={20} className="shrink-0" />
      {PRACTICE_BANNER}
    </div>
  );
}
