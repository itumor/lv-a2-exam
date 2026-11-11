"use client";
import type { Skill } from "@/lib/exam-engine/rules";
import { cx, SKILL_UI } from "@/lib/ui/skill";

export type Choice = { id: string; label: string };

/** One answer per row with a letter badge. Native radios give arrow-key support for free. */
export function OptionList({ name, label, options, value, onChange, skill }: { name: string; label: string; options: Choice[]; value: string | undefined; onChange: (id: string) => void; skill: Skill }) {
  const ui = SKILL_UI[skill];
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2.5 lg:gap-3">
      {options.map((o, i) => {
        const checked = o.id === value;
        return (
          <label
            key={o.id}
            className={cx(
              "flex min-h-[62px] cursor-pointer items-center gap-3 rounded-button border-2 border-b-4 px-3.5 py-2.5 text-[17px] lg:min-h-[70px] lg:gap-3.5 lg:rounded-card lg:px-[18px] lg:py-3 lg:text-[19px]",
              checked ? cx(ui.tint, ui.border, ui.text, "font-black") : "border-line bg-surface font-extrabold text-ink",
            )}
          >
            <input type="radio" name={name} value={o.id} checked={checked} onChange={() => onChange(o.id)} className="sr-only" />
            <span
              aria-hidden="true"
              className={cx(
                "flex size-[30px] shrink-0 items-center justify-center rounded-[10px] border-2 text-sm font-black lg:size-[34px] lg:text-[15px]",
                checked ? cx(ui.bg, ui.border, "text-white") : "border-line-strong text-muted",
              )}
            >
              {o.id.length === 1 ? o.id : "ABCDEFGHI"[i]}
            </span>
            {o.label}
          </label>
        );
      })}
    </div>
  );
}
