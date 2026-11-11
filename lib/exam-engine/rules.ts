// Official VIAA 2026 A2 rules (spec section 2). Pure, no I/O.

export const SKILLS = ["listening", "reading", "writing", "speaking"] as const;
export type Skill = (typeof SKILLS)[number];
export type Scores = Record<Skill, number>;
/** null = evaluation still pending. */
export type PartialScores = Record<Skill, number | null>;

export const SECTION_MAX = 15;
export const PASS_MIN = 9;
export const TOTAL_MAX = 60;

/** Section time limits in minutes. Speaking is 10–15 min; the deadline uses the upper bound. */
export const SECTION_MINUTES: Record<Skill, number> = {
  listening: 25,
  reading: 30,
  writing: 35,
  speaking: 15,
};

/** Pass only if EVERY skill is an integer from 9 to 15. A high total never compensates. */
export const passed = (s: Scores) =>
  Object.values(s).every((n) => Number.isInteger(n) && n >= PASS_MIN && n <= SECTION_MAX);

export const totalScore = (s: Scores) => Object.values(s).reduce((sum, n) => sum + n, 0);

export type Outcome =
  | { status: "pending"; pendingSkills: Skill[] }
  | { status: "final"; total: number; passed: boolean; below: { skill: Skill; short: number }[] };

/** A pending evaluation is neither pass nor fail. */
export function outcome(scores: PartialScores): Outcome {
  const pendingSkills = SKILLS.filter((k) => scores[k] === null);
  if (pendingSkills.length > 0) return { status: "pending", pendingSkills };
  const s = scores as Scores;
  return {
    status: "final",
    total: totalScore(s),
    passed: passed(s),
    below: SKILLS.filter((k) => s[k] < PASS_MIN).map((skill) => ({ skill, short: PASS_MIN - s[skill] })),
  };
}
