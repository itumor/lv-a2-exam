// Exam-set manifest schema (spec section 8). One manifest = one immutable exam set.
import { z } from "zod";
import { SKILLS } from "@/lib/exam-engine/rules";

const skill = z.enum(SKILLS);

export const mediaSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["audio", "image"]),
  /** Path under /public, or null while the asset has not been produced. */
  src: z.string().nullable(),
  sha256: z.string().nullable(),
  durationSec: z.number().positive().optional(),
  /** Images: alt text, sent to the client. */
  descriptionLv: z.string().optional(),
  /** Audio: script for recording. SERVER ONLY, it contains the answers. */
  transcriptLv: z.string().optional(),
  reviewStatus: z.enum(["draft", "approved"]),
  placeholder: z.boolean().default(false),
});

const optionSchema = z.object({ id: z.string().min(1), lv: z.string().min(1) });
const advertSchema = z.object({ id: z.string().min(1), titleLv: z.string().min(1), bodyLv: z.string().min(1) });

export const KINDS = [
  "single_choice", "true_false", "word_bank", "match", "word_form",
  "free_text", "interview", "picture_description", "ask_questions",
] as const;

export const itemSchema = z.object({
  externalId: z.string().min(1),
  section: skill,
  taskNumber: z.number().int().min(1).max(3),
  kind: z.enum(KINDS),
  prompt: z.object({
    lv: z.string().min(1),
    /** Reading task 1: the text the statements are about. */
    textLv: z.string().optional(),
    /** Writing task 3: plan points, each as [bold verb, rest]. */
    planLv: z.array(z.tuple([z.string(), z.string()])).optional(),
    /** Writing task 1: profile card lines. */
    cardLv: z.array(z.string()).optional(),
    /** Speaking task 1: examiner questions. */
    questionsLv: z.array(z.string()).optional(),
    /** Speaking task 3: adverts with missing information. */
    advertsLv: z.array(advertSchema).optional(),
  }),
  options: z.array(optionSchema).default([]),
  /** SERVER ONLY. null for open tasks graded by rubric. */
  answerKey: z.union([z.object({ correct: z.string() }), z.object({ accepted: z.array(z.string().min(1)).min(1) })]).nullable(),
  maxPoints: z.number().int().min(1),
  rubricVersion: z.string().min(1),
  media: z.array(mediaSchema),
  minWords: z.number().int().positive().optional(),
  targetWords: z.number().int().positive().optional(),
  placeholder: z.boolean().default(false),
});

export const taskSchema = z.object({
  section: skill,
  taskNumber: z.number().int().min(1).max(3),
  instructionLv: z.string().min(1),
  /** Counter noun, e.g. "paziņojums" -> "2. paziņojums no 6". */
  unitLv: z.string().optional(),
  /** per_item: one screen per item. all_items: one screen for the whole task. */
  layout: z.enum(["per_item", "all_items"]),
  shared: z
    .object({
      media: mediaSchema.optional(),
      textLv: z.string().optional(),
      adverts: z.array(advertSchema).optional(),
      wordBank: z.array(optionSchema).optional(),
    })
    .default({}),
  placeholder: z.boolean().default(false),
});

export const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  examSetSlug: z.string().min(1),
  version: z.number().int().positive(),
  title: z.string().min(1),
  level: z.literal("A2"),
  blueprintId: z.string().min(1),
  status: z.enum(["draft", "in_review", "published"]),
  reviewed_by: z.string().nullable(),
  notes: z.array(z.string()).default([]),
  tasks: z.array(taskSchema),
  sections: z.object({
    listening: z.array(itemSchema),
    reading: z.array(itemSchema),
    writing: z.array(itemSchema),
    speaking: z.array(itemSchema),
  }),
});

export type Media = z.infer<typeof mediaSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
