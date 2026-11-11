// Client-safe projection of a manifest: no answer keys, no audio transcripts.
import { isSpoken } from "@/lib/exam-engine/scoring";
import { SKILLS, type Skill } from "@/lib/exam-engine/rules";
import type { Item, Manifest, Media, Task } from "./schema";

export type PublicMedia = Omit<Media, "transcriptLv" | "sha256">;
export type PublicItem = Omit<Item, "answerKey" | "media"> & { media: PublicMedia[]; partCount: number };
export type PublicTask = Omit<Task, "shared"> & { shared: Omit<Task["shared"], "media"> & { media?: PublicMedia } };

const TRUE_FALSE = [
  { id: "true", lv: "Pareizi" },
  { id: "false", lv: "Nepareizi" },
];

/** Fill in options that are implied by the task: true/false, the word bank, advert letters. */
export function hydrate(m: Manifest): Manifest {
  const sections = { ...m.sections };
  for (const skill of SKILLS) {
    sections[skill] = m.sections[skill].map((item) => {
      if (item.options.length > 0) return item;
      const shared = m.tasks.find((t) => t.section === skill && t.taskNumber === item.taskNumber)?.shared;
      if (item.kind === "true_false") return { ...item, options: TRUE_FALSE };
      if (item.kind === "word_bank") return { ...item, options: shared?.wordBank ?? [] };
      if (item.kind === "match") return { ...item, options: (shared?.adverts ?? []).map((a) => ({ id: a.id, lv: a.id })) };
      return item;
    });
  }
  return { ...m, sections };
}

/** How many recordings a spoken item expects. */
export function partCount(item: Item): number {
  if (item.kind === "interview") return item.prompt.questionsLv?.length ?? 0;
  if (item.kind === "picture_description") return item.media.filter((x) => x.kind === "image").length;
  if (item.kind === "ask_questions") return item.prompt.advertsLv?.length ?? 0;
  return 1;
}

const publicMedia = ({ transcriptLv: _t, sha256: _s, ...rest }: Media): PublicMedia => rest;

export const toPublicItem = ({ answerKey: _key, ...item }: Item): PublicItem => ({
  ...item,
  media: item.media.map(publicMedia),
  partCount: partCount(item as Item),
});

export const toPublicTask = (task: Task): PublicTask => ({
  ...task,
  shared: { ...task.shared, media: task.shared.media ? publicMedia(task.shared.media) : undefined },
});

export type PublicSection = { skill: Skill; tasks: PublicTask[]; items: PublicItem[] };

export function toPublicSection(m: Manifest, skill: Skill): PublicSection {
  return {
    skill,
    tasks: m.tasks.filter((t) => t.section === skill).map(toPublicTask),
    items: m.sections[skill].map(toPublicItem),
  };
}

/** One screen of the runner. `part` is set for spoken items with several recordings. */
export type Step = { taskNumber: number; itemIds: string[]; part: number | null; index: number; count: number };

export function buildSteps({ tasks, items }: Pick<PublicSection, "tasks" | "items">): Step[] {
  const steps: Step[] = [];
  for (const task of [...tasks].sort((a, b) => a.taskNumber - b.taskNumber)) {
    const taskItems = items.filter((i) => i.taskNumber === task.taskNumber);
    type Screen = Omit<Step, "index" | "count">;
    const screens: Screen[] =
      task.layout === "all_items"
        ? [{ taskNumber: task.taskNumber, itemIds: taskItems.map((i) => i.externalId), part: null }]
        : taskItems.flatMap((i): Screen[] =>
            isSpoken(i.kind)
              ? Array.from({ length: i.partCount }, (_, part) => ({ taskNumber: task.taskNumber, itemIds: [i.externalId], part }))
              : [{ taskNumber: task.taskNumber, itemIds: [i.externalId], part: null }],
          );
    screens.forEach((s, index) => steps.push({ ...s, index, count: screens.length }));
  }
  return steps;
}
