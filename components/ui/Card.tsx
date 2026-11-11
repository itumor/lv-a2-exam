import type { ComponentProps } from "react";
import { cx } from "@/lib/ui/skill";

/** White surface with a 2px line border. `chunky` adds the thicker bottom edge. */
export function Card({ as: Tag = "div", chunky = false, className, ...rest }: ComponentProps<"div"> & { as?: "div" | "section" | "article"; chunky?: boolean }) {
  return <Tag {...rest} className={cx("rounded-card border-2 border-line bg-surface", chunky && "border-b-[5px]", className)} />;
}
