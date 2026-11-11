// Icon paths are taken from the design HTML. Stroke follows the text colour.
import type { ReactNode } from "react";
import type { Skill } from "@/lib/exam-engine/rules";

type Props = { size?: number; strokeWidth?: number; className?: string };

const icon = (children: ReactNode, defaultStroke = 2.2) =>
  function Icon({ size = 24, strokeWidth = defaultStroke, className }: Props) {
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
        {children}
      </svg>
    );
  };

export const StairsIcon = icon(<path d="M3 20h6v-5h6v-5h6V5" />, 2.4);
export const FlameIcon = icon(<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z" />, 2.4);
export const CloseIcon = icon(<path d="M6 6l12 12M18 6L6 18" />, 2.6);
export const BackIcon = icon(<path d="M15 5l-7 7 7 7" />, 2.6);
export const ClockIcon = icon(<><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M9 2h6" /></>, 2.4);
export const InfoIcon = icon(<><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v.5" /></>);
export const HomeIcon = icon(<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />);
export const TargetIcon = icon(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>);
export const BarsIcon = icon(<path d="M5 20V10M12 20V4M19 20v-7" />);
export const PersonIcon = icon(<><circle cx="12" cy="8" r="4" /><path d="M4 20c1-4 4-6 8-6s7 2 8 6" /></>);
export const SpeakerIcon = icon(<><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M17 9a4 4 0 0 1 0 6" /></>);
export const MicIcon = icon(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>, 2.4);
export const CheckIcon = icon(<path d="M5 12l5 5 9-10" />, 2.6);

const HeadphonesIcon = icon(<><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></>);
const BookIcon = icon(<><path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z" /><path d="M12 6v14" /></>);
const PencilIcon = icon(<><path d="M4 20l4-1L19 8l-3-3L5 16l-1 4z" /><path d="M14 7l3 3" /></>);
const SpeechIcon = icon(<path d="M4 5h16v11H10l-5 4v-4H4z" />);

export const SKILL_ICON: Record<Skill, (p: Props) => ReactNode> = {
  listening: HeadphonesIcon,
  reading: BookIcon,
  writing: PencilIcon,
  speaking: SpeechIcon,
};

/** Filled glyphs for the audio and recorder buttons. */
export function GlyphIcon({ name, size = 24, className }: { name: "play" | "pause" | "stop"; size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      {name === "play" && <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />}
      {name === "pause" && <><rect x="6" y="5" width="4" height="14" rx="1.5" /><rect x="14" y="5" width="4" height="14" rx="1.5" /></>}
      {name === "stop" && <rect x="6" y="6" width="12" height="12" rx="3" />}
    </svg>
  );
}
