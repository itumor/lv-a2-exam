import Link from "next/link";
import { PRODUCT } from "@/lib/config";
import { cx } from "@/lib/ui/skill";
import { BarsIcon, FlameIcon, HomeIcon, PersonIcon, StairsIcon, TargetIcon } from "./icons";

export type NavKey = "home" | "practice" | "results" | "account";

// ponytail: Practice and Account are not built yet (later milestones); they open a stub page.
const LINKS = [
  { key: "home", label: "Home", href: "/dashboard", Icon: HomeIcon },
  { key: "practice", label: "Practice", href: "/coming-soon", Icon: TargetIcon },
  { key: "results", label: "Results", href: "/exam/mock-exam-1/results", Icon: BarsIcon },
  { key: "account", label: "Account", href: "/coming-soon", Icon: PersonIcon },
] as const;

export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-10 items-center justify-center rounded-key bg-primary text-white">
        <StairsIcon />
      </div>
      <div className="text-xl font-black">
        {PRODUCT.name} <span className="text-primary-text">{PRODUCT.level}</span>
      </div>
    </div>
  );
}

export function Streak({ days, className }: { days: number; className?: string }) {
  return (
    <div className={cx("flex items-center gap-1.5 rounded-full bg-accent-tint px-3 py-2 text-sm font-extrabold text-accent-text lg:px-3.5", className)}>
      <FlameIcon size={16} />
      {days} day streak
    </div>
  );
}

/** Desktop navigation, from 1024px. */
export function TopNav({ active, streakDays }: { active: NavKey; streakDays: number }) {
  return (
    <nav aria-label="Main" className="gutter hidden flex-wrap items-center gap-x-8 gap-y-2 border-b-2 border-line bg-surface py-3.5 lg:flex">
      <Brand />
      <div className="flex flex-wrap gap-1">
        {LINKS.map(({ key, label, href }) => (
          <Link
            key={key}
            href={href}
            aria-current={key === active ? "page" : undefined}
            className={cx("rounded-key px-4 py-3 text-[15px] no-underline", key === active ? "bg-primary-tint font-black text-primary-text" : "font-extrabold text-ink-soft")}
          >
            {label}
          </Link>
        ))}
      </div>
      <Streak days={streakDays} className="ml-auto" />
    </nav>
  );
}

/** Mobile navigation, below 1024px. */
export function BottomNav({ active }: { active: NavKey }) {
  return (
    <nav aria-label="Main" className="mt-auto grid grid-cols-4 border-t-2 border-line bg-surface px-2 pt-2 pb-4 lg:hidden">
      {LINKS.map(({ key, label, href, Icon }) => (
        <Link
          key={key}
          href={href}
          aria-current={key === active ? "page" : undefined}
          className={cx("flex min-h-11 flex-col items-center gap-0.5 py-1.5 text-xs no-underline", key === active ? "font-black text-primary-text" : "font-extrabold text-muted")}
        >
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  );
}
