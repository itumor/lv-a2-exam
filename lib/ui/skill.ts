import type { Skill } from "@/lib/exam-engine/rules";

// Skill colours are fixed: listening blue, reading green, writing orange, speaking magenta.
// Class names are written out in full so Tailwind can see them.
export const SKILL_UI: Record<Skill, { lv: string; en: string; time: string; bg: string; tint: string; text: string; border: string; shadow: string }> = {
  listening: { lv: "Klausīšanās", en: "Listening", time: "25 min", bg: "bg-listening", tint: "bg-listening-tint", text: "text-listening-shadow", border: "border-listening", shadow: "border-b-listening-shadow" },
  reading: { lv: "Lasīšana", en: "Reading", time: "30 min", bg: "bg-reading", tint: "bg-reading-tint", text: "text-reading-shadow", border: "border-reading", shadow: "border-b-reading-shadow" },
  writing: { lv: "Rakstīšana", en: "Writing", time: "35 min", bg: "bg-writing", tint: "bg-writing-tint", text: "text-writing-shadow", border: "border-writing", shadow: "border-b-writing-shadow" },
  speaking: { lv: "Runāšana", en: "Speaking", time: "10–15 min", bg: "bg-speaking", tint: "bg-speaking-tint", text: "text-speaking-shadow", border: "border-speaking", shadow: "border-b-speaking-shadow" },
};

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");
