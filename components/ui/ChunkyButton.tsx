import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/ui/skill";

const BASE = "flex h-[52px] cursor-pointer items-center justify-center rounded-button border-0 border-b-4 text-[17px] font-black no-underline disabled:cursor-not-allowed disabled:opacity-60";
const VARIANT = {
  primary: "bg-primary border-primary-shadow text-white hover:text-white",
  accent: "bg-accent border-accent-shadow text-ink hover:text-ink",
};

type Common = { variant?: keyof typeof VARIANT; className?: string; children: ReactNode };

/** Filled button with a 4px darker bottom edge. Renders a link when `href` is given. */
export function ChunkyButton(props: Common & ({ href: string } | ({ href?: undefined } & Omit<ComponentProps<"button">, "className" | "children">))) {
  const { variant = "primary", className, children, ...rest } = props;
  const classes = cx(BASE, VARIANT[variant], className);
  if (rest.href !== undefined) return <Link href={rest.href} className={classes}>{children}</Link>;
  return <button type="button" {...rest} className={classes}>{children}</button>;
}
