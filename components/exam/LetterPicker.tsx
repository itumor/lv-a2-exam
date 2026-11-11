"use client";
import type { Skill } from "@/lib/exam-engine/rules";
import { cx, SKILL_UI } from "@/lib/ui/skill";
import type { Choice } from "./OptionList";

const COLS = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };

/** Compact grid of choices: A–D for matching, or short words. */
export function LetterPicker({ name, label, options, value, onChange, skill, columns = 4 }: { name: string; label: string; options: Choice[]; value: string | undefined; onChange: (id: string) => void; skill: Skill; columns?: keyof typeof COLS }) {
  const ui = SKILL_UI[skill];
  return (
    <div role="radiogroup" aria-label={label} className={cx("grid gap-2.5 lg:gap-3", COLS[columns])}>
      {options.map((o) => {
        const checked = o.id === value;
        return (
          <label
            key={o.id}
            className={cx(
              "flex min-h-[52px] cursor-pointer items-center justify-center rounded-button border-2 border-b-4 px-2 text-center font-black lg:min-h-[60px] lg:rounded-card",
              o.label.length > 2 ? "text-[15px] lg:text-[17px]" : "text-lg lg:text-xl",
              checked ? cx(ui.bg, ui.border, ui.shadow, "text-white") : "border-line bg-surface text-ink",
            )}
          >
            <input type="radio" name={name} value={o.id} checked={checked} onChange={() => onChange(o.id)} className="sr-only" />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}
