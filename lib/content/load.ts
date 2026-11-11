import "server-only";
import raw from "@/content/exam-sets/a2-original-001.json";
import { hydrate } from "./public";
import { manifestSchema, type Manifest } from "./schema";

// ponytail: one bundled exam set. Replace with a catalog lookup when there is a second one.
let cached: Manifest | undefined;

/** Full manifest INCLUDING answer keys. Never pass the result to a client component. */
export function loadExamSet(): Manifest {
  return (cached ??= hydrate(manifestSchema.parse(raw)));
}
