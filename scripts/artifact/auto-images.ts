// Lists every image address an automatically built project's page uses, so
// the single-page build can embed them (the Artifact viewer only shows images
// stored in the page). Bundled and run by scripts/build-artifact.mjs:
//   node auto-images.cjs <spec.json> [trace.json]
import { readFileSync } from "node:fs";
import { buildAutoBundle } from "../../src/features/selector/data/auto/build";

const [specPath, tracePath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const trace = tracePath ? JSON.parse(readFileSync(tracePath, "utf8")) : null;
const urls = new Set<string>();
const walk = (v: unknown): void => {
  if (typeof v === "string") {
    if (/^https?:\/\//.test(v) && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(v)) urls.add(v);
  } else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === "object") Object.values(v).forEach(walk);
};
walk(buildAutoBundle(spec, trace));
process.stdout.write(JSON.stringify([...urls]));
