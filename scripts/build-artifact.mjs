// Builds the Stack & Unit Selector into one self-contained HTML file
// (dist-artifact/selector.html) for publishing as a claude.ai Artifact.
// Everything is inlined because artifacts only load scripts from a few CDNs.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const out = "dist-artifact";
// Every image is embedded as a data URI: the Artifact viewer refuses image
// URLs to the page's own files. The site plan is inlined here; photos, floor
// plans and the map are compressed by scripts/artifact/embed_assets.py.
const sitePlan = `data:image/jpeg;base64,${readFileSync("public/thomson-reserve/site-plan.jpg").toString("base64")}`;
mkdirSync(out, { recursive: true });
execFileSync("python3", ["scripts/artifact/embed_assets.py"], { stdio: "inherit" });

const js = await build({
  entryPoints: ["scripts/artifact/entry.tsx"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  write: false,
  alias: { "next/dynamic": "./scripts/artifact/next-dynamic-shim.tsx" },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_TR_SITE_PLAN": JSON.stringify(sitePlan),
    "process.env.NEXT_PUBLIC_TR_PLAN_BASE": JSON.stringify("plans"),
    "process.env.NEXT_PUBLIC_TR_IMAGE_BASE": JSON.stringify("images"),
    // The viewer only shows images embedded in the page, so photos and plans ship as data URIs.
    __TRM_EMBEDDED_ASSETS__: readFileSync(`${out}/embedded-assets.json`, "utf8"),
  },
  legalComments: "none",
});
const script = js.outputFiles[0].text.replaceAll("</script", "<\\/script");

execFileSync("npx", ["@tailwindcss/cli", "-i", "src/app/globals.css", "-o", `${out}/app.css`, "--minify"], {
  stdio: "inherit",
});
const css = readFileSync(`${out}/app.css`, "utf8");

const html = `<title>TRM Stack &amp; Unit Selector</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800&display=swap">
<style>
:root{--font-archivo:"Archivo",system-ui,-apple-system,"Segoe UI",sans-serif;--font-newsreader:"Newsreader",Georgia,"Times New Roman",serif;color-scheme:light}
${css}
/* Artifact frame: keep sticky and fixed bars clear of phone system bars */
header.sticky{top:env(safe-area-inset-top,0px)}
.fixed.bottom-0{padding-bottom:env(safe-area-inset-bottom,0px)}
</style>
<div id="root"></div>
<script>${script}</script>
`;
writeFileSync(`${out}/selector.html`, html);
console.log(`dist-artifact/selector.html ${(html.length / 1024 / 1024).toFixed(2)} MB`);
