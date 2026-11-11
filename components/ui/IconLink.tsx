import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/ui/skill";

/** 44px square icon link (close, back). */
export function IconLink({ href, label, className, children }: { href: string; label: string; className?: string; children: ReactNode }) {
  return (
    <Link href={href} aria-label={label} className={cx("flex size-11 shrink-0 items-center justify-center rounded-control border-2 border-line bg-surface text-muted hover:text-ink", className)}>
      {children}
    </Link>
  );
}
