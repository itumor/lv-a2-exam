import type { ReactNode } from "react";
import type { Skill } from "@/lib/exam-engine/rules";
import { cx, SKILL_UI } from "@/lib/ui/skill";

export function SkillChip({ skill, children }: { skill: Skill; children: ReactNode }) {
  const ui = SKILL_UI[skill];
  return <div className={cx("rounded-full px-3 py-1.5 text-[13px] font-black lg:px-3.5 lg:text-sm", ui.tint, ui.text)}>{children}</div>;
}
