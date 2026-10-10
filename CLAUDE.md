@AGENTS.md

# TRM — The Realty Master: Thomson Reserve Stack & Unit Selector

A Next.js website for TRM (a Huttons Associate) that helps buyers choose a
unit at a new launch. Thomson Reserve (1–11 Bright Hill Drive, 1,268 units,
6 towers) is the first complete project and the template for others: any
development is added as a project bundle without changing the shared code.
The Serra Residences (7 Bassein Road, 133 units, one 28-storey tower) is the
second, built from the Huttons New Launch API pull (`pull-project.py`).
Every other project on the new launches map (95 on 5 Oct 2026; projects
launched before 2020 are left off the map and the list) has a mini site built automatically from one data file per project
(`scripts/huttons/build-sites.py` → `data/auto/`), with the same eight tabs.

Every project has the same eight tabs, in this order: Project & 3D Site,
Plans, Units & Payments, Schools, Investor, Alternative Projects, PIVOT, My
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
TRM_PROJECT=the-serra-residences npm run build:artifact  # The Serra Residences' single page
TRM_PROJECT=sample-wrenfield npm run build:artifact   # another project's single page
TRM_PROJECT=huttons-map npm run build:artifact        # the new launches map
TRM_PROJECT=arina-east-residences npm run build:artifact  # any automatic mini site (downloads and embeds its Huttons images)

# Daily data refresh (needs HUTTONS_API_KEY, HUTTONS_API_SECRET, URA_ACCESS_KEY)
python3 scripts/huttons/sync-catalogue.py
python3 scripts/huttons/sync-project.py "Thomson Reserve" src/features/selector/data/thomson-reserve/huttons-units.ts
python3 scripts/huttons/sync-project.py "The Serra Residences" src/features/selector/data/the-serra-residences/huttons-units.ts
python3 scripts/huttons/build-sites.py   # every other map project's mini site data (about 25 minutes)
python3 scripts/huttons/nearby-projects.py --all   # each project's four nearest alternatives (seconds, no API)
python3 scripts/ura/sync-transactions.py   # URA sales and rents within 1.5 km of each map project
python3 scripts/ura/sync-comparables.py    # chosen comparables' URA sales and rents (+ Huttons first sales)
```

URA's Data Service answers 403 when called too quickly; the scripts wait
and retry. `URA_FIXTURES=dir` reads saved responses
(`PMI_Resi_Transaction_<batch>.json`, `PMI_Resi_Rental_<yyqn>.json`) instead.

Run `npm test`, `npm run typecheck` and `npm run lint` before every commit.

## 3. Where things are

- `src/app/` — pages: `page.tsx` (home, lists live projects), `map/page.tsx`
  (the new launches map), `city-3d/page.tsx` (Thomson Reserve in Google's 3D
  city),
  `projects/[slug]/page.tsx` (each project), `selector/page.tsx` (old
  Thomson Reserve address, kept for shared links).
- `src/components/` — site header, footer, register form.
- `src/content/site.ts` — agency details shown in the footer. The website is
  generic: personal contact details are left out (fields stay null).
- `src/features/selector/model/types.ts` — the site data model. Every value
  carries its source, date and status (verified, estimated, assumed, unknown).
  A unit can carry its own `layoutId` and `box` when its type differs from
  its stack's (e.g. upper floors joining stacks); use `ix.unitLayout(unit)`
  (or `layoutLookup(ds)`) for a unit's size and bedrooms, never the stack's.
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
  - `huttons-units.ts`: every unit's availability and (once released) list
    and nett price from the Huttons New Launch API, generated by
    `scripts/huttons/sync-project.py` (don't edit by hand); applied to the
    dataset by `lib/listing.ts`, so real prices replace the estimates
  - `alternatives.ts`: alternative projects (TRM's comparison page); their
    unit types, starting prices and units left come from
    `alternatives-huttons.ts`, generated from the Huttons New Launch API by
    `scripts/huttons/sync-alternatives.py` (don't edit by hand)
  - `osm-context.ts`: neighbourhood buildings, roads, parks and water from
    OpenStreetMap, generated by `scripts/osm/build-context.py` from an
    `.osm` export (don't edit by hand)
  - `hdb-blocks.ts`: highest floor of each HDB block nearby (HDB Property
    Information, data.gov.sg) at its OneMap address point, generated by
    `scripts/data/hdb-storeys.py` (don't edit by hand)
  - `map-context.ts`: turns that into the 3D map layer and into view
    obstructions (buildings of 4+ storeys with a recorded storey count);
    an OpenStreetMap footprint containing an HDB block's point takes HDB's
    storey count
- `src/features/selector/data/the-serra-residences/` — The Serra Residences:
  `huttons-project.ts`, `huttons-units.ts`, `huttons-media.ts` (from
  `pull-project.py`; don't edit by hand), `index.ts` (one tower, stacks
  01–07 traced from the developer's unit distribution plans at 161 px = 25 m,
  plan north 12°; homes on levels 4–16, Sky Terrace on 17, four larger homes
  a floor on stacks 01/03/05/07 for levels 18–27, penthouses on 28; floor
  heights assumed; views not assessed), `bundle.ts` (the API names the two
  sections as blocks "(L4-L16)" and "(L18-28)"; the bundle maps both to the
  tower "7"; indicative starting prices from the Huttons flyer of 2 Oct 2026
  in `pricing.startingPrices`, shown as published; illustrative $3,120 psf at
  level 4 + $30 a floor, fitted to within 3% of them; OneMap school
  distances), `nearby-projects.ts` (its Alternative Projects: the four
  nearest map projects, from `scripts/huttons/nearby-projects.py`; don't edit
  by hand), `entry.tsx`. Images and plans in `public/the-serra-residences/`.
- `src/features/selector/data/nearby.ts` — turns a nearby-projects list into
  Alternative Projects cards. `scripts/huttons/nearby-projects.py <slug>|--all`
  picks, from the map's catalogue (no API calls), the four nearest projects
  on the map still selling (or not yet launched) a bedroom type the project
  offers, by straight line between map positions, with each shared type's
  lowest price, psf, psf range and units left. Thomson Reserve keeps TRM's
  own comparison (`alternatives.ts`). A project not released yet (no unit
  types) is compared on every bedroom type; shops, offices, factories and
  landed-only projects get none. The automatic mini sites use the same
  list (`nearby` in their spec).
- `src/features/selector/data/auto/` — the automatic mini sites:
  `specs/<slug>.json` (one per project, from `scripts/huttons/build-sites.py`:
  every unit, floor plan and site plan image addresses on Huttons' image
  server, which allows cross-origin use, public renders, MRT walk, OneMap
  primary school distances, nearest comparable projects; don't edit by
  hand), `traces/<slug>.json` (TRM's tracing of the site plan: scale, north,
  crop, block cores, stack positions; `docs/tracing-site-plans.md`,
  `scripts/trace/trace_tools.py prep|zoom|check`), `registry.ts` (generated
  list and loaders; `build-sites.py --registry` after adding a trace),
  `build.ts` (spec + trace → ProjectBundle; untraced projects get a
  schematic 3D layout with `facingKnown: false` on every stack, so facings
  and sun are shown as not known), `entry.tsx`. `projects.ts` registers
  them; only `featured` projects (Thomson Reserve, The Serra Residences)
  appear on the home page. Illustrative prices for an auto site appear only
  when none of its units is priced: the median psf of the nearest projects'
  cheapest available units plus $15 a floor, labelled as such.
- `src/features/selector/data/comparables/chosen.ts` — TRM's chosen
  comparable project(s) for each project's resale and rental records, from
  the project sheet (`exports/trm-map-projects-comparables.xlsx`, column O)
  by `scripts/data/comparables-from-sheet.py <xlsx>`: located on OneMap
  (address, district from the postcode, distance, "(U/C)" = still being
  built) and matched to the Huttons catalogue (tenure, units, completion);
  don't edit by hand. `chosen-notes.ts` is the website's "Why it's
  comparable" for each, written from TRM's note: figures only from TRM's
  note (credited to TRM), OneMap or the catalogue; tests check its
  distances. `choice.ts` builds the Investor tab card
  (`components/comparable-choice.tsx`; also on coming-soon pages) until the
  comparable's URA records are loaded. `ura-comparables.ts` (from
  `scripts/ura/sync-comparables.py`; don't edit by hand) holds each
  comparable's URA sales by year (new, sub-sale, resale, median psf), resales
  by floor range, latest 20 sales, rents by bedrooms and by quarter, tenure,
  and what first buyers paid (Huttons unit records, where it is a Huttons
  project); `components/comparable-records.tsx` shows them with "change since
  launch" and an indicative gross yield. URA doesn't link a resale to the
  earlier purchase, so no per-unit profit comes from URA.
- `src/features/selector/data/comparables/jadescape.ts` — 321 JadeScape
  resales (Huttons report, 22 Sep 2026), generated from the spreadsheet;
  `jadescape-rentals.ts` — 881 leases (3 Oct 2026), generated by
  `scripts/data/rentals-from-csv.py`.
- `src/features/catalogue/` — the new launches map: `model.ts`, `lib.ts`
  (distances, nearby projects to recommend, CAGR from the median psf trend
  or matched resales; price by bedroom; district shading bands; clusters),
  `geo.ts` (projection, district and URA region of a point),
  `components/projects-map.tsx` (URA market regions in three colours — CCR
  lavender `#E9DDF7`/purple `#7952B3`, RCR peach `#FBE3CA`/burnt orange
  `#B96524`, OCR teal `#D8EEE7`/deep teal `#247C69` — over parks, water and
  major roads on a `#EAF2F5` sea; floating region filter that fits the map;
  grouped zoom and reset (44px targets); labels placed without collisions by
  `placeLabels` (regions and neighbourhoods at the overview, district numbers
  as you zoom in); compact navy markers for New launch and Upcoming (no units released counts as Upcoming; sold-out projects, resale and projects launched before 2020 are not shown: `FIRST_LAUNCH_YEAR` in `lib.ts`, `client.on_map` in the scripts)
  with count bubbles; district hover/tap card with region shares and listing
  count; compact project card with photo (`data/images.ts`); a "Price
  heatmap" view with its own legend when average psf is available),
  `data/sg-layers.ts` (regions at subzone level, parks, water, major roads,
  neighbourhood names; from `scripts/data/sg-map-layers.py`, which reuses
  `scripts/data/subzone-districts.json`),
  `data/sg-districts.ts` (D01–D28 approximated by grouping URA subzones by
  the postcodes of OneMap addresses inside them, from
  `scripts/data/sg-districts.py`; needs Shapely), `data/huttons-catalogue.ts` (every Huttons project in Singapore, 303 on
  5 Oct 2026, generated by `scripts/huttons/sync-catalogue.py`, which also
  saves 480 px copies of the main images of projects on the map to
  `public/catalogue/<id>.jpg`, listed in `data/catalogue-images.ts`, so the
  single page can embed them), `data/ura-market.ts` (URA sales
  and rents near each project, from `scripts/ura/sync-transactions.py`),
  `data/evidence.ts` (JadeScape's report figures), `data/sg-basemap.ts`
  (from `scripts/data/sg-basemap.py`). Built as its own single page with
  `TRM_PROJECT=huttons-map npm run build:artifact`.
- `src/features/selector/data/demo/` — a fictional sample project
  (`/projects/sample-wrenfield`), never published; tests check that nothing
  from Thomson Reserve leaks into it.
- `src/features/selector/lib/` — the calculations: `clearance.ts` (View
  Clearance Floor Marker), `solar.ts` (sun), `exposure.ts` (noise and
  privacy), `access.ts` (MRT walk), `estimate.ts` (illustrative prices),
  `pricing.ts`, `recommend.ts`, `resale.ts` (exit appeal), `comparable.ts`
  (profit by floor band), `scene.ts` (3D), `payments.ts` (payment
  estimate, loan by LTV), `stamp-duty.ts` (IRAS Buyer's and Additional
  Buyer's Stamp Duty by buyer profile), `listing.ts` (applies the Huttons
  unit list), `rentals.ts` (rent evidence), `pivot.ts` (PIVOT framework,
  workings and exit projection), `progressive.ts` (progressive payments by construction stage, standard
  Housing Developers Rules schedule), `selling.ts` (cash proceeds from selling), `alternatives.ts`
  (size-for-size comparison with alternative projects),
  `valuation.ts` (checks a valuation request), `project-check.ts` (checks a
  bundle before publishing).
  Tests are in `lib/__tests__/`.
- `src/features/selector/components/` — the UI. `project-app.tsx` lays out
  the eight tabs; `tabs.tsx` has the tab names, introductions and "Not added
  yet" card; `ui.tsx` the shared buttons, `Disclosure` and `NextStep`;
  `unit-summary.tsx` the selected unit; `compare-cards.tsx` the comparison;
  `payment-calculator.tsx`; `pivot-tab.tsx`; `charts.tsx` (shared SVG
  charts: line, bar, waterfall, scatter and split bar, each with hover
  tooltips and a "Show the numbers" table; colours checked for colour-blind
  readers); `stack-price-chart.tsx`; `photo-band.tsx` (a project photo on the
  numbers-heavy tabs, from `media.tabPhotos` in the bundle); `alternatives-tab.tsx`; `upgrading-tab.tsx` (valuation
  request and cash proceeds); `plans-tab.tsx` (all floor plans, the
  elevation chart in the developer's unit type colours, the site plan);
  `site-view.tsx` the 3D view and its controls (the flat `site-plan.tsx`
  only shows when the browser has no WebGL); `site-3d.tsx` the 3D model,
  including the developer's distances between blocks
  (`display.distances` in the dataset);
  `price-matrix.tsx` the price-by-floor table.
- `src/app/actions.ts` — `registerInterest` and `requestValuation` post to
  `LEAD_WEBHOOK_URL` and only report success when it accepts the request.
  The single-page build swaps in `scripts/artifact/actions-stub.ts`, which
  never reports a request as sent.
- `docs/adding-a-project.md`, `docs/project-intake-checklist.md` and
  `docs/sample-project/` — how to add the next development.
- `public/thomson-reserve/` — site plan, its mask (`site-plan-mask.png`,
  white where the plan shows the site), floor plans, images.
- `scripts/huttons/client.py` — the shared Huttons API client (token reuse,
  retries; `HUTTONS_FIXTURES=dir` answers from saved JSON for testing).
  `sync-catalogue.py` refreshes the map's catalogue; `pull-project.py
  "Name" slug` pulls a new project's units, floor plans, site plans and
  public images as its starting kit (docs/adding-a-project.md).
- `src/features/city3d/city-3d.tsx` — CesiumJS (loaded from jsDelivr, or
  `NEXT_PUBLIC_CESIUM_BASE`) with Google Photorealistic 3D Tiles
  (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; Map Tiles API, billing on, key limited
  to the site's address). Places `public/thomson-reserve/3d/towers.glb` from
  `placement.json`, samples the road height for its base, clips Google's scan
  of the plot, sun and shadows by date and time, fly-in, and tapping a stack
  opens `/projects/thomson-reserve?stack=<id>`. Without a key it falls back
  to OpenStreetMap. Website only: the single-page build can't load outside
  map data (`NEXT_PUBLIC_SINGLE_PAGE` hides the link there).
- `scripts/3d/site-outline.py` (site outline from the plan mask, for
  clipping) and `scripts/3d/export-glb.mts` (`npx tsx`; the selector's massing
  to GLB in an east-north-up frame, one mesh per stack, plus placement.json).
  Re-run both after changing blocks or stacks. CesiumJS needs
  `forwardAxis: Axis.X` for this model, or it turns it to face east.
- `scripts/ura/sync-transactions.py` — URA sales (five years) and rents (four
  quarters) of condos and apartments within 1.5 km of every map project.
  Needs `URA_ACCESS_KEY` (free registration with URA); `svy21.py` converts
  URA's grid to latitude and longitude.
- `scripts/huttons/sync-project.py` — pulls a project's units, availability and
  prices from the Huttons New Launch API (api.singmap.com). Reads
  `HUTTONS_API_KEY` and `HUTTONS_API_SECRET` from the environment; never commit
  them. Fetches no agent contacts or internal media.
- `scripts/onemap/school-distances.py` — primary schools within about 2.5 km
  of each block, from OneMap address points (needs www.onemap.gov.sg allowed).
- `scripts/build-artifact.mjs` and `scripts/artifact/` — the single-page build.
  For an automatic mini site (`TRM_PROJECT=<slug>` with a spec in
  `data/auto/specs/`), `auto-entry.tsx` renders it, `auto-images.ts` lists the
  image addresses its bundle uses and `embed_remote.py` downloads and embeds
  them, keyed by address, so `AssetImg` and `assetSrc` find them (set
  `SSL_CERT_FILE=/root/.ccr/ca-bundle.crt` in cloud sessions). Published:
  Arina East Residences, https://claude.ai/artifact/89wwTydUfsVZ9tBif1r3e5
  (linked from the map's single page in `catalogue/artifact-entry.tsx`).

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
- Exit appeal, out of 100: less competition (up to 50) plus the floor band's
  resale record at JadeScape (low 0, mid 10, high 30), out of 80, rescaled
  to 100. Distinctive features are not scored (removed at TRM's request).
- Every page with figures carries the standard disclaimer
  (`NumbersDisclaimer` in `ui.tsx`). Dollar amounts the visitor types use
  `AmountInput` (`amount-input.tsx`), which shows thousands separators (1,803,000).
- Label every render "Artist's impression".
- Do not commit developer PDFs. Never publish the project bank account details
  in the factsheet.
- Write in plain words for home buyers, not system terms. Say "unit" for a
  selectable home and "project" for a development; explain "stack" where it
  first appears. Buttons say what happens ("Add to comparison", "Calculate
  payments"); errors give the problem then the fix.
- Numbers-heavy tabs show their figures as charts as well as text, using
  `charts.tsx`, and may carry a project photo (`media.tabPhotos`) to soften
  the page, but only where the photo is relevant (Schools and Alternative
  Projects have none). The first tab (Project & 3D Site) stays as it is.
- Alternative projects are compared only on the bedroom types this project
  offers, at the project's standard estimate (Thomson Reserve: $2,850 psf on
  the lowest level plus $15 psf per floor), not the visitor's adjustments.
- Keep the eight tabs and their order. Each tab opens with its one-line
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
10. **Before go-live.** Run `scripts/huttons/sync-project.py` to load the price
    list and availability, connect
    enquiries (`LEAD_WEBHOOK_URL`), and confirm the
    agency details.
