@AGENTS.md

# TRM — The Realty Master: Thomson Reserve Stack & Unit Selector

A Next.js website for TRM (a Huttons Associate) that helps buyers choose a
home at Thomson Reserve (1–11 Bright Hill Drive, 1,268 homes, 6 towers):
a 3D site model, illustrative prices by level, floor plans, view clearance,
sun, noise, MRT access, recommendations and a resale scenario calculator.
The same app is also built as one self-contained HTML page for sharing as a
claude.ai Artifact.

## 1. Plugins and tools to install

Opening this repo in Claude Code offers the plugins below automatically,
because `.claude/settings.json` lists them. To add them by hand, run these in
Claude Code:

```
/plugin marketplace add anthropics/claude-plugins-official
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin marketplace add 21st-dev/magic-mcp
/plugin marketplace add pbakaus/impeccable

/plugin install frontend-design@claude-plugins-official
/plugin install figma@claude-plugins-official
/plugin install context7@claude-plugins-official
/plugin install vercel@claude-plugins-official
/plugin install supabase@claude-plugins-official
/plugin install mapbox@claude-plugins-official
/plugin install modern-web-guidance@claude-plugins-official
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill
/plugin install 21st@21st-dev
/plugin install impeccable@impeccable
```

| Plugin / server | Used for | Notes |
|---|---|---|
| frontend-design | Visual direction, typography, layout | |
| ui-ux-pro-max | UI/UX rules, palettes, chart guidance | |
| impeccable | Design critique and polish | |
| 21st | Ready-made UI components | Needs a 21st.dev account |
| figma | Read and write Figma files | Sign in to Figma when asked |
| context7 | Up-to-date library docs | |
| vercel | Deploying the site | Also install the CLI: `npm i -g vercel` |
| supabase | Database, e.g. storing enquiries | Sign in when asked |
| mapbox | Maps and location data | Needs a Mapbox token |
| modern-web-guidance | Current web platform guidance | |
| Playwright (MCP, `.mcp.json`) | Browser testing and screenshots | Started by `scripts/playwright-mcp.sh`; uses the preinstalled Chromium in cloud sessions |
| shadcn (MCP, `.mcp.json`) | shadcn/ui components | Runs with `npx shadcn@latest mcp` |
| aetumi (MCP, `.mcp.json`) | AETumi tools | Remote server |
| blender (MCP, `.mcp.json`) | 3D modelling in Blender | Needs Blender and its add-on running locally; needs `uv` |

The Playwright *plugin* is switched off on purpose: it expects Google Chrome,
which cloud sessions don't have. Use the Playwright MCP server instead.

Other tools: Node.js 22 or later, Python 3 with Pillow (`pip install Pillow`,
for the artifact build) and PyMuPDF (`pip install pymupdf`, only to extract
data and images from developer PDFs).

In Claude Code cloud sessions the network policy blocks many hosts (Figma,
Vercel, Supabase, Mapbox, Context7, proplus.huttons.sg). Allow them under the
environment's Network access settings, then start a new session.

## 2. Commands

```
npm install             # install dependencies
npm run dev             # local site at http://localhost:3000 (selector at /selector)
npm test                # unit tests (Vitest)
npm run typecheck       # TypeScript
npm run lint            # ESLint
npm run build           # production build
npm run build:artifact  # dist-artifact/selector.html, the single-page version
```

Run `npm test`, `npm run typecheck` and `npm run lint` before every commit.

## 3. Where things are

- `src/app/` — pages: `page.tsx` (home), `selector/page.tsx` (the selector).
- `src/components/` — site header, footer, register form.
- `src/content/site.ts` — agency and agent contact details shown in the footer.
- `src/features/selector/model/types.ts` — the data model. Every value
  carries its source, date and status (verified, estimated, assumed, unknown).
- `src/features/selector/data/thomson-reserve/` — the project data:
  - `index.ts`: blocks, stacks (traced from the site plan), units, heights,
    gates, routes, noise sources, view rules
  - `unit-schedule.ts`: unit type for every stack and level (from the
    developer's elevation charts)
  - `floor-plans.ts`: unit type → floor plan image
  - `surroundings.ts`: landed estates, forest, view target
  - `gallery.ts`: renders and the location map
- `src/features/selector/lib/` — the calculations: `clearance.ts` (View
  Clearance Floor Marker), `solar.ts` (sun), `exposure.ts` (noise and
  privacy), `access.ts` (MRT walk), `estimate.ts` (illustrative prices),
  `pricing.ts`, `recommend.ts`, `scenario.ts`, `resale.ts`, `scene.ts` (3D).
  Tests are in `lib/__tests__/`.
- `src/features/selector/components/` — the UI. `selector-app.tsx` lays out
  the page; `site-3d.tsx` is the 3D model; `unit-panel.tsx` is the
  selected-home panel; `price-matrix.tsx` is the price-by-level table.
- `public/thomson-reserve/` — site plan, floor plans, images.
- `scripts/build-artifact.mjs` and `scripts/artifact/` — the single-page build.

## 4. Rules for this project

- Never invent figures. Unknown values stay unknown and are labelled; never
  fill a gap with a guess presented as fact.
- Prices are illustrative until the developer's price list is loaded: base
  PSF at the lowest level plus a step per floor (default $2,850 + $15), or set
  by average PSF. Every estimate is marked "est." and is never presented as
  the developer's price. Real prices, once loaded, replace estimates.
- View clearance uses TRM's on-site assessment: south-west-facing stacks clear
  the landed homes from level 5, north-east-facing stacks clear the HDB
  blocks from level 21, and a stack facing another Thomson Reserve block must
  also clear that block's roof.
- Homes start at level 1 in the Luxury blocks (5 and 7) and level 2 in the
  Classic blocks (1, 3, 9, 11); typical floors start at level 3.
- Label every render "Artist's impression".
- Do not commit developer PDFs. Never publish the project bank account details
  in the factsheet.
- Write in plain words for home buyers, not system terms.

## 5. Gotchas

- This is Next.js 16: read `node_modules/next/dist/docs/` before using a Next
  API. `next/image` uses `preload` or `loading="eager"`, not `priority`.
- Artifact pages only show images embedded in the page, so the artifact build
  turns every image into a data URI (`scripts/artifact/embed_assets.py`).
  Use `AssetImg` from `components/asset-image.tsx` for images, not `<img>`.
- Test the artifact under a strict CSP (`img-src data: blob:`), not by
  opening the file from disk, or broken images go unnoticed.
- Browser tests in cloud sessions: launch Chromium from
  `/opt/pw-browsers/chromium` with `--use-angle=swiftshader` for WebGL.
- When the plan is rotated, use `project.planNorthDeg` (40° for Thomson
  Reserve) for every bearing, sun vector and compass.

## 6. How to build this from scratch

1. **Create the app.** `npx create-next-app@latest` with TypeScript, Tailwind,
   ESLint and the App Router. Add `three`, `@react-three/fiber`,
   `@react-three/drei`, and dev tools `vitest`, `esbuild`, `@tailwindcss/cli`.
2. **Set up Claude Code.** Install the plugins in section 1, add `.mcp.json`
   and `scripts/playwright-mcp.sh`, and copy this file.
3. **Brand and pages.** Pick fonts and colour tokens in `globals.css` (TRM uses
   Archivo and Newsreader on a dark green and mist palette). Build the
   header, footer and home page.
4. **Data model first.** Write `model/types.ts`: project, blocks, stacks,
   layouts, units, obstructions, view targets, routes, noise sources, each
   with provenance. Build a small fictional dataset to develop against.
5. **Calculations, with tests.** Geometry and floor heights, then sun position
   (NOAA formulas), view clearance (sight lines over obstructions with height
   ranges), noise screening, MRT walk, pricing, recommendations and the
   resale scenario. Write tests as you go.
6. **The UI.** Selector page with filter bar, 3D site model (instanced boxes
   per home on the site plan image), selected-home panel, stack and floor
   analysis, price section, recommendations, comparison and scenario
   calculator. Check every screen at phone width.
7. **Load the real project.** From the developer's site plan, trace each
   stack's position (with the plan's scale bar and north point). From the
   elevation charts, build the unit type for every stack and level. From the
   factsheet, take sizes, storeys and heights. From the unit plans, extract
   one floor plan image per type. Check totals against the factsheet's unit
   mix (1,268 homes).
8. **Add the local knowledge.** Surroundings and view rules, gates and the
   covered linkway, renders, the location map and illustrative prices.
9. **Share it.** `npm run build:artifact`, then publish
   `dist-artifact/selector.html` as an Artifact; or deploy the Next.js site
   with `vercel`.
10. **Before go-live.** Load the price list and availability, add the agent's
    name, CEA number and WhatsApp in `src/content/site.ts`, and confirm the
    agency details.
