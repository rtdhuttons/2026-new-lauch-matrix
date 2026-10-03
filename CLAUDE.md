@AGENTS.md

# TRM — The Realty Master: Thomson Reserve Stack & Unit Selector

A Next.js website for TRM (a Huttons Associate) that helps buyers choose a
unit at a new launch. Thomson Reserve (1–11 Bright Hill Drive, 1,268 units,
6 towers) is the first complete project and the template for others: any
development is added as a project bundle without changing the shared code.

Every project has the same seven tabs, in this order: Project & 3D Site,
Units & Payments, Schools, Investor, Alternative Projects, PIVOT, My
Upgrading Plan. My Shortlist (up to three units) is a utility on every tab.
The same app is also built as one self-contained HTML page per project for
sharing as a claude.ai Artifact.

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
npm run build:artifact  # dist-artifact/selector.html, Thomson Reserve's single page
TRM_PROJECT=sample-wrenfield npm run build:artifact   # another project's single page
```

Run `npm test`, `npm run typecheck` and `npm run lint` before every commit.

## 3. Where things are

- `src/app/` — pages: `page.tsx` (home, lists live projects),
  `projects/[slug]/page.tsx` (each project), `selector/page.tsx` (old
  Thomson Reserve address, kept for shared links).
- `src/components/` — site header, footer, register form.
- `src/content/site.ts` — agency details shown in the footer. The website is
  generic: personal contact details are left out (fields stay null).
- `src/features/selector/model/types.ts` — the site data model. Every value
  carries its source, date and status (verified, estimated, assumed, unknown).
- `src/features/selector/model/project.ts` — the project bundle: everything
  the website knows about one development, with source kinds (developer,
  official, third-party, agent, calculated, illustrative) and checked dates.
- `src/features/selector/data/projects.ts` — the list of projects (live or
  sample) and how each loads.
- `src/features/selector/data/thomson-reserve/` — the project data
  (`bundle.ts` is the bundle, `entry.tsx` its page):
  - `index.ts`: blocks, stacks (traced from the site plan), units, heights,
    gates, routes, noise sources, view rules
  - `unit-schedule.ts`: unit type for every stack and level (from the
    developer's elevation charts)
  - `floor-plans.ts`: unit type → floor plan image
  - `surroundings.ts`: landed estates, forest, view target
  - `gallery.ts`: renders and the location map
  - `alternatives.ts`: alternative projects with unit types, starting prices
    and units left (from TRM's comparison page)
  - `osm-context.ts`: neighbourhood buildings, roads, parks and water from
    OpenStreetMap, generated by `scripts/osm/build-context.py` from an
    `.osm` export (don't edit by hand)
  - `map-context.ts`: turns that into the 3D map layer and into view
    obstructions (buildings of 4+ storeys with a recorded storey count)
- `src/features/selector/data/comparables/jadescape.ts` — 321 JadeScape
  resales (Huttons report, 22 Sep 2026), generated from the spreadsheet;
  `jadescape-rentals.ts` — 881 leases (3 Oct 2026), generated by
  `scripts/data/rentals-from-csv.py`.
- `src/features/selector/data/demo/` — a fictional sample project
  (`/projects/sample-wrenfield`), never published; tests check that nothing
  from Thomson Reserve leaks into it.
- `src/features/selector/lib/` — the calculations: `clearance.ts` (View
  Clearance Floor Marker), `solar.ts` (sun), `exposure.ts` (noise and
  privacy), `access.ts` (MRT walk), `estimate.ts` (illustrative prices),
  `pricing.ts`, `recommend.ts`, `resale.ts` (exit appeal), `comparable.ts`
  (profit by floor band), `scene.ts` (3D), `payments.ts` (payment
  estimate), `rentals.ts` (rent evidence), `pivot.ts` (PIVOT framework,
  workings and exit projection), `selling.ts` (cash proceeds from selling), `alternatives.ts`
  (size-for-size comparison with alternative projects),
  `valuation.ts` (checks a valuation request), `project-check.ts` (checks a
  bundle before publishing).
  Tests are in `lib/__tests__/`.
- `src/features/selector/components/` — the UI. `project-app.tsx` lays out
  the seven tabs; `tabs.tsx` has the tab names, introductions and "Not added
  yet" card; `ui.tsx` the shared buttons, `Disclosure` and `NextStep`;
  `unit-summary.tsx` the selected unit; `compare-cards.tsx` the comparison;
  `payment-calculator.tsx`; `pivot-tab.tsx`; `charts.tsx` (shared SVG
  charts: line, bar, waterfall, scatter and split bar, each with hover
  tooltips and a "Show the numbers" table; colours checked for colour-blind
  readers); `stack-price-chart.tsx`; `photo-band.tsx` (a project photo on the
  numbers-heavy tabs, from `media.tabPhotos` in the bundle); `alternatives-tab.tsx`; `upgrading-tab.tsx` (valuation
  request and cash proceeds); `site-3d.tsx` the 3D model;
  `price-matrix.tsx` the price-by-floor table.
- `src/app/actions.ts` — `registerInterest` and `requestValuation` post to
  `LEAD_WEBHOOK_URL` and only report success when it accepts the request.
  The single-page build swaps in `scripts/artifact/actions-stub.ts`, which
  never reports a request as sent.
- `docs/adding-a-project.md`, `docs/project-intake-checklist.md` and
  `docs/sample-project/` — how to add the next development.
- `public/thomson-reserve/` — site plan, its mask (`site-plan-mask.png`,
  white where the plan shows the site), floor plans, images.
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
- Exit appeal, out of 100: less competition (up to 50), the floor band's
  resale record at JadeScape (low 0, mid 10, high 30) and distinctive
  features (up to 20).
- Label every render "Artist's impression".
- Do not commit developer PDFs. Never publish the project bank account details
  in the factsheet.
- Write in plain words for home buyers, not system terms. Say "unit" for a
  selectable home and "project" for a development; explain "stack" where it
  first appears. Buttons say what happens ("Add to comparison", "Calculate
  payments"); errors give the problem then the fix.
- Numbers-heavy tabs show their figures as charts as well as text, using
  `charts.tsx`, and carry a project photo (`media.tabPhotos`) to soften the
  page. The first tab (Project & 3D Site) stays as it is.
- Alternative projects are compared only on the bedroom types this project
  offers, at the project's standard estimate (Thomson Reserve: $2,850 psf on
  the lowest level plus $15 psf per floor), not the visitor's adjustments.
- Keep the seven tabs and their order. Each tab opens with its one-line
  purpose; detail goes behind named expandable sections; a task ends with one
  suggested next step.
- Project-specific rules (starting floors, view clearance, pricing
  assumptions, PIVOT figures) live in the project's bundle, never in shared
  code.

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
- The OpenStreetMap layer is fitted to the site plan at the plan's scale bar
  (2.66 px/m), rotated 40°, shifted so MRT Exit 2 lands on the plan's
  marker. To refresh it, export a new `.osm` from openstreetmap.org (the
  cloud network policy blocks the OSM hosts, so download it locally) and run
  `python3 scripts/osm/build-context.py map.osm`. Keep the "© OpenStreetMap
  contributors" credit on screen.

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
   ranges), noise screening, MRT walk, pricing, recommendations and exit
   appeal. Write tests as you go.
6. **The UI.** Selector page with filter bar, 3D site model (instanced boxes
   per home on the site plan image), selected-home panel, stack and floor
   analysis, price section, profit by floor band, recommendations and
   comparison. Check every screen at phone width.
7. **Load the real project.** From the developer's site plan, trace each
   stack's position (with the plan's scale bar and north point). From the
   elevation charts, build the unit type for every stack and level. From the
   factsheet, take sizes, storeys and heights. From the unit plans, extract
   one floor plan image per type. Check totals against the factsheet's unit
   mix (1,268 homes).
8. **Add the local knowledge.** Surroundings and view rules, gates and the
   covered linkway, renders, the location map and illustrative prices. Add
   the neighbourhood from an OpenStreetMap export with
   `scripts/osm/build-context.py`.
9. **Share it.** `npm run build:artifact`, then publish
   `dist-artifact/selector.html` as an Artifact; or deploy the Next.js site
   with `vercel`.
10. **Before go-live.** Load the price list and availability, connect
    enquiries (`LEAD_WEBHOOK_URL`), and confirm the
    agency details.
