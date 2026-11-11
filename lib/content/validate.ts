// Manifest validation (spec section 8). Pure: file access is injected.
import { isObjective } from "@/lib/exam-engine/scoring";
import { SECTION_MAX, SKILLS, type Skill } from "@/lib/exam-engine/rules";
import { hydrate, partCount, toPublicSection } from "./public";
import { manifestSchema, type Item, type Manifest, type Media } from "./schema";

export type MediaProbe = (src: string) => { exists: boolean; sha256?: string };
export type Report = { errors: string[]; warnings: string[]; manifest: Manifest | null };

/** Official point structure: points per task, and item count where each item is 1 point. */
const TASK_POINTS: Record<Skill, [number, number, number]> = {
  listening: [6, 4, 5],
  reading: [4, 6, 5],
  writing: [4, 5, 6],
  speaking: [0, 0, 3], // tasks 1+2 share 12 points, checked separately
};
const ONE_POINT_ITEMS: Partial<Record<Skill, number[]>> = { listening: [1, 2, 3], reading: [1, 2, 3], writing: [2] };

const hasKey = (value: unknown, key: string): boolean =>
  typeof value === "object" && value !== null &&
  (key in value || Object.values(value).some((v) => hasKey(v, key)));

export function validateManifest(raw: unknown, probe: MediaProbe): Report {
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.issues.map((i) => `schema: ${i.path.join(".")}: ${i.message}`), warnings: [], manifest: null };
  }
  const m = hydrate(parsed.data);
  const errors: string[] = [];
  const warnings: string[] = [];
  const draft = m.status !== "published";
  /** Problems that are tolerated in a draft but block publishing. */
  const gate = (msg: string) => (draft ? warnings : errors).push(msg);

  const all = SKILLS.flatMap((s) => m.sections[s]);
  const task = (s: Skill, n: number) => m.sections[s].filter((i) => i.taskNumber === n);
  const points = (items: Item[]) => items.reduce((sum, i) => sum + i.maxPoints, 0);

  // identity
  const seen = new Set<string>();
  for (const i of all) {
    if (seen.has(i.externalId)) errors.push(`duplicate externalId ${i.externalId}`);
    seen.add(i.externalId);
  }
  for (const s of SKILLS) {
    for (const i of m.sections[s]) if (i.section !== s) errors.push(`${i.externalId}: section "${i.section}" is listed under ${s}`);
    for (const n of [1, 2, 3]) {
      const defs = m.tasks.filter((t) => t.section === s && t.taskNumber === n);
      if (defs.length !== 1) errors.push(`${s} task ${n}: expected exactly 1 task definition, found ${defs.length}`);
    }
  }

  // points
  for (const s of SKILLS) {
    if (points(m.sections[s]) !== SECTION_MAX) errors.push(`${s}: ${points(m.sections[s])} points, must be exactly ${SECTION_MAX}`);
    TASK_POINTS[s].forEach((want, idx) => {
      if (want && points(task(s, idx + 1)) !== want) errors.push(`${s} task ${idx + 1}: ${points(task(s, idx + 1))} points, must be ${want}`);
    });
    for (const n of ONE_POINT_ITEMS[s] ?? []) {
      if (task(s, n).some((i) => i.maxPoints !== 1)) errors.push(`${s} task ${n}: every item must be worth 1 point`);
    }
  }
  const speaking12 = points(task("speaking", 1)) + points(task("speaking", 2));
  if (speaking12 !== 12) errors.push(`speaking tasks 1+2: ${speaking12} points, must be 12 combined`);

  // task formats
  const optionCount = (s: Skill, n: number, want: number) => {
    for (const i of task(s, n)) if (i.options.length !== want) errors.push(`${i.externalId}: ${i.options.length} options, must be ${want}`);
  };
  optionCount("listening", 1, 3);
  optionCount("listening", 2, 2);
  optionCount("listening", 3, 9);
  optionCount("reading", 1, 3);
  optionCount("reading", 2, 4);
  optionCount("reading", 3, 3);
  const [w1] = task("writing", 1);
  if (task("writing", 1).length !== 1 || (w1?.minWords ?? 0) < 30) errors.push("writing task 1: one item with minWords >= 30");
  const [w3] = task("writing", 3);
  if (task("writing", 3).length !== 1 || w3?.prompt.planLv?.length !== 5) errors.push("writing task 3: one item with exactly 5 plan points");
  const [s1] = task("speaking", 1);
  const questions = s1 ? partCount(s1) : 0;
  if (task("speaking", 1).length !== 1 || questions < 9 || questions > 10) errors.push(`speaking task 1: ${questions} interview questions, must be 9–10`);
  const [s2] = task("speaking", 2);
  if (task("speaking", 2).length !== 1 || !s2 || partCount(s2) !== 2) errors.push("speaking task 2: exactly 2 picture stimuli");
  const [s3] = task("speaking", 3);
  if (task("speaking", 3).length !== 1 || !s3 || partCount(s3) !== 3) errors.push("speaking task 3: exactly 3 adverts");

  // answer keys
  for (const i of all) {
    if (!isObjective(i.kind)) {
      if (i.answerKey) errors.push(`${i.externalId}: open task must not have an answer key`);
      continue;
    }
    if (!i.answerKey) errors.push(`${i.externalId}: missing answer key`);
    else if ("correct" in i.answerKey) {
      const key = i.answerKey.correct;
      if (i.kind === "word_form") errors.push(`${i.externalId}: word_form needs answerKey.accepted`);
      else if (!i.options.some((o) => o.id === key)) errors.push(`${i.externalId}: key "${key}" is not one of the options`);
    } else if (i.kind !== "word_form") errors.push(`${i.externalId}: choice item needs answerKey.correct`);
  }

  // media
  const media: { owner: string; media: Media }[] = [
    ...all.flatMap((i) => i.media.map((x) => ({ owner: i.externalId, media: x }))),
    ...m.tasks.flatMap((t) => (t.shared.media ? [{ owner: `${t.section} task ${t.taskNumber}`, media: t.shared.media }] : [])),
  ];
  const mediaIds = new Set<string>();
  for (const { owner, media: x } of media) {
    if (mediaIds.has(x.id)) errors.push(`duplicate media id ${x.id}`);
    mediaIds.add(x.id);
    if (x.kind === "image" && !x.descriptionLv) errors.push(`${owner}: image ${x.id} has no description`);
    if (x.kind === "audio" && !x.transcriptLv) errors.push(`${owner}: audio ${x.id} has no transcript`);
    if (x.reviewStatus !== "approved") gate(`${owner}: media ${x.id} is not approved`);
    if (x.src === null) gate(`${owner}: media ${x.id} has no file yet`);
    else {
      const file = probe(x.src);
      if (!file.exists) errors.push(`${owner}: media file ${x.src} does not exist`);
      else if (!x.sha256) errors.push(`${owner}: media ${x.id} has no sha256`);
      else if (file.sha256 !== x.sha256) errors.push(`${owner}: media ${x.id} sha256 does not match ${x.src}`);
    }
  }
  for (const i of [...task("listening", 1), ...task("listening", 3)]) {
    if (!i.media.some((x) => x.kind === "audio")) errors.push(`${i.externalId}: listening item has no audio`);
  }
  if (!m.tasks.find((t) => t.section === "listening" && t.taskNumber === 2)?.shared.media) errors.push("listening task 2: no shared dialogue audio");

  // review gate
  const placeholders = all.filter((i) => i.placeholder).length + m.tasks.filter((t) => t.placeholder).length;
  if (placeholders) gate(`${placeholders} placeholder items or tasks`);
  if (m.reviewed_by === null) gate("reviewed_by is null: no native-speaker teacher has approved this set");

  // answer keys and transcripts must never reach the client
  for (const s of SKILLS) {
    const pub = toPublicSection(m, s);
    if (hasKey(pub, "answerKey") || hasKey(pub, "transcriptLv")) errors.push(`${s}: client projection leaks protected fields`);
  }

  return { errors, warnings, manifest: m };
}
