import { SKILLS, type Skill } from "@/lib/exam-engine/rules";
import { cx, SKILL_UI } from "@/lib/ui/skill";
import { CloseIcon, ClockIcon } from "@/components/ui/icons";
import { IconLink } from "@/components/ui/IconLink";

/** Close button, four-segment progress (done = primary, current = skill colour), countdown. */
export function ExamHeader({ skill, time }: { skill: Skill; time: string }) {
  const part = SKILLS.indexOf(skill);
  const label = `${part + 1}. daļa no 4`;
  return (
    <header className="gutter flex items-center gap-3 pt-5 pb-3 lg:flex-wrap lg:gap-x-5 lg:border-b-2 lg:border-line lg:bg-surface lg:py-3.5">
      <IconLink href="/dashboard" label="Pārtraukt eksāmenu">
        <CloseIcon size={20} />
      </IconLink>
      <div className="hidden text-base font-black lg:block">
        {label} · {SKILL_UI[skill].lv}
      </div>
      <div role="img" aria-label={label} className="grid flex-1 grid-cols-4 gap-1.5 lg:max-w-[420px] lg:basis-[200px]">
        {SKILLS.map((k, i) => (
          <div key={k} className={cx("h-2.5 rounded-full", i < part ? "bg-primary" : i === part ? SKILL_UI[skill].bg : "bg-track")} />
        ))}
      </div>
      <div role="timer" aria-label="Atlikušais laiks" className="flex items-center gap-1.5 rounded-control border-2 border-line bg-surface px-2.5 py-[9px] text-[15px] font-black tabular-nums lg:ml-auto lg:px-3 lg:text-base">
        <ClockIcon size={18} />
        {time}
      </div>
    </header>
  );
}
