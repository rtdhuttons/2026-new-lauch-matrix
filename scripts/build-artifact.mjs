// Builds one project's website into a single self-contained HTML file for
// publishing as a claude.ai Artifact. Everything is inlined because
// artifacts only load scripts from a few CDNs.
//
//   npm run build:artifact                          # Thomson Reserve -> dist-artifact/selector.html
//   TRM_PROJECT=sample-wrenfield npm run build:artifact
//   TRM_PROJECT=arina-east-residences npm run build:artifact   # any automatic mini site
//
// Only the chosen project's entry (and so its data) is bundled.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { build } from "esbuild";
import { ARTIFACT_PROJECTS } from "./artifact/projects.mjs";

const projectId = process.env.TRM_PROJECT ?? "thomson-reserve";
// Any automatically built project (data/auto/specs/<slug>.json) can be built too;
// its photos and plans are downloaded from Huttons' image server and embedded.
const specPath = `src/features/selector/data/auto/specs/${projectId}.json`;
const tracePath = `src/features/selector/data/auto/traces/${projectId}.json`;
const auto = !ARTIFACT_PROJECTS[projectId] && existsSync(specPath) ? { spec: specPath, trace: existsSync(tracePath) ? tracePath : null } : null;
const cfg = ARTIFACT_PROJECTS[projectId] ??
  (auto && {
    entry: "scripts/artifact/auto-entry.tsx",
    out: `${projectId}.html`,
    title: `TRM · ${JSON.parse(readFileSync(specPath, "utf8")).name}`,
    defines: {},
    embed: [],
  });
if (!cfg) throw new Error(`Unknown project "${projectId}". Known: ${Object.keys(ARTIFACT_PROJECTS).join(", ")}`);

const out = "dist-artifact";
const assetsFile = `${out}/embedded-assets-${projectId}.json`;
// Every image is embedded as a data URI: the Artifact viewer refuses image
// URLs to the page's own files. The site plan is inlined here; photos, floor
// plans and the map are compressed by scripts/artifact/embed_assets.py.
const inline = (f) => (f ? `data:${f.type};base64,${readFileSync(f.file).toString("base64")}` : undefined);
mkdirSync(out, { recursive: true });
execFileSync("python3", ["scripts/artifact/embed_assets.py", JSON.stringify(cfg.embed), assetsFile], { stdio: "inherit" });
if (auto) {
  // List the page's web images by building the project's data, then embed them.
  await build({ entryPoints: ["scripts/artifact/auto-images.ts"], bundle: true, platform: "node", format: "cjs", outfile: `${out}/auto-images.cjs`, logLevel: "warning" });
  const urls = execFileSync("node", [`${out}/auto-images.cjs`, auto.spec, ...(auto.trace ? [auto.trace] : [])], { encoding: "utf8", maxBuffer: 1 << 26 });
  writeFileSync(`${out}/auto-images-${projectId}.json`, urls);
  execFileSync("python3", ["scripts/artifact/embed_remote.py", `${out}/auto-images-${projectId}.json`, assetsFile], { stdio: "inherit" });
}

const defines = Object.fromEntries(Object.entries(cfg.defines).map(([k, v]) => [`process.env.${k}`, JSON.stringify(v)]));
// Lets shared code leave out what only works on the website (e.g. Google's 3D city).
defines["process.env.NEXT_PUBLIC_SINGLE_PAGE"] = JSON.stringify("1");
for (const f of [cfg.planImage, cfg.planMask]) if (f) defines[`process.env.${f.env}`] = JSON.stringify(inline(f));

const js = await build({
  entryPoints: ["scripts/artifact/entry.tsx"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  write: false,
  alias: {
    "next/dynamic": "./scripts/artifact/next-dynamic-shim.tsx",
    "next/link": "./scripts/artifact/next-link-shim.tsx",
    "@trm/project-entry": `./${cfg.entry}`,
    ...(auto ? { "@trm/auto-spec": `./${auto.spec}`, "@trm/auto-trace": auto.trace ? `./${auto.trace}` : "./scripts/artifact/no-trace.json" } : {}),
    // No server in a single page: requests report that they can't be sent.
    "@/app/actions": "./scripts/artifact/actions-stub.ts",
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    ...defines,
    // The viewer only shows images embedded in the page, so photos and plans ship as data URIs.
    __TRM_EMBEDDED_ASSETS__: readFileSync(assetsFile, "utf8"),
  },
  legalComments: "none",
});
const script = js.outputFiles[0].text.replaceAll("</script", "<\\/script");

execFileSync("npx", ["@tailwindcss/cli", "-i", "src/app/globals.css", "-o", `${out}/app.css`, "--minify"], {
  stdio: "inherit",
});
const css = readFileSync(`${out}/app.css`, "utf8");

const html = `<meta charset="utf-8">
<title>${cfg.title.replaceAll("&", "&amp;")}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800&display=swap">
<style>
:root{--font-archivo:"Archivo",system-ui,-apple-system,"Segoe UI",sans-serif;--font-newsreader:"Newsreader",Georgia,"Times New Roman",serif;color-scheme:light}
${css}
/* Artifact frame: keep sticky and fixed bars clear of phone system bars */
nav.sticky{top:env(safe-area-inset-top,0px)}
.fixed.bottom-0{padding-bottom:env(safe-area-inset-bottom,0px)}
</style>
<div id="root"></div>
<script>${script}</script>
`;
writeFileSync(`${out}/${cfg.out}`, html);
console.log(`${out}/${cfg.out} ${(html.length / 1024 / 1024).toFixed(2)} MB`);
