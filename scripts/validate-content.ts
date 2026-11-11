// Validates every manifest in content/exam-sets. Exit code 1 on any error.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateManifest, type MediaProbe } from "../lib/content/validate";

const root = join(import.meta.dirname, "..");
const dir = join(root, "content", "exam-sets");

const probe: MediaProbe = (src) => {
  const file = join(root, "public", src);
  if (!existsSync(file)) return { exists: false };
  return { exists: true, sha256: createHash("sha256").update(readFileSync(file)).digest("hex") };
};

let failed = false;
for (const name of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const { errors, warnings, manifest } = validateManifest(JSON.parse(readFileSync(join(dir, name), "utf8")), probe);
  console.log(`\n${name}: status=${manifest?.status ?? "?"} reviewed_by=${manifest?.reviewed_by ?? "null"}`);
  for (const w of warnings) console.log(`  warning: ${w}`);
  for (const e of errors) console.log(`  ERROR: ${e}`);
  console.log(`  ${errors.length} errors, ${warnings.length} warnings`);
  if (errors.length) failed = true;
}
process.exit(failed ? 1 : 0);
