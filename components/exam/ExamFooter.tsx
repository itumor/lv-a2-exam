import type { ReactNode } from "react";
import { ChunkyButton } from "@/components/ui/ChunkyButton";

/** Sticky-bottom action bar. `mobileNote` shows on phones, `note` on desktop. */
export function ExamFooter({ note, mobileNote, label, onNext, busy }: { note?: ReactNode; mobileNote?: ReactNode; label: string; onNext: () => void; busy?: boolean }) {
  return (
    <footer className="mt-auto border-t-2 border-line bg-surface">
      <div className="gutter mx-auto flex max-w-[1120px] flex-col gap-2.5 pt-3.5 pb-6 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:pt-4 lg:pb-5">
        {mobileNote && <div className="text-center text-[13px] text-muted lg:hidden">{mobileNote}</div>}
        <div className="hidden text-sm text-muted lg:block">{note}</div>
        <ChunkyButton onClick={onNext} disabled={busy} className="lg:min-w-[162px] lg:px-10">
          {label}
        </ChunkyButton>
      </div>
    </footer>
  );
}
