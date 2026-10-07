# TRM — Thomson Reserve Stack & Unit Selector

The guide for the Thomson Reserve part of the TRM website, in the same style as
`CLAUDE.md` but covering this one project only. Use it to work on Thomson
Reserve alone, or as the starting point for a single-project repo.

TRM (The Realty Master, a Huttons Associate) built this to help buyers choose
a unit at Thomson Reserve: the stack (the vertical column of units sharing the
same position and layout), the floor, the floor plan, the view, the sun, the
price and the payments. It is a Next.js website and also one self-contained
HTML page for sharing as a claude.ai Artifact:
https://claude.ai/artifact/5kRAW7usFiDUPDepbFZjSP

## 1. The project

| | |
|---|---|
| Address | 1–11 Bright Hill Drive, Singapore 579580–579608 (District 20) |
| Developer | Tamarind Development Pte. Ltd. (CapitaLand Development, UOL Group and Singapore Land Group) |
| Tenure | 99 years from 14 July 2026 |
| Homes | 1,268 in six towers: 2 of 30 storeys (Luxury blocks 5 and 7) and 4 of 21 (Classic blocks 1, 3, 9 and 11) |
| MRT | Upper Thomson (Thomson–East Coast Line), 65 m covered link from Side Gate 1 |
| Launch | 31 Oct 2026 (Huttons New Launch API) |
| Completion | Vacant possession expected 28 Feb 2031; legal completion 28 Feb 2034 |
| Land | $810,000,000, $1,178 psf ppr (TRM's PIVOT e-book) |

Sources: developer factsheet V1 (22 Sep 2026; bank details withheld),
elevation charts, unit plans, site plan, architect's brief and marketing
material; Huttons New Launch API; TRM's on-site assessment and PIVOT e-book
(2 Jul 2026); Huttons JadeScape reports; SLA OneMap; OpenStreetMap; HDB
Property Information (data.gov.sg).

## 2. The eight tabs

Same order on every page; My Shortlist (up to three units) works on every tab.

1. **Project & 3D Site.** The six towers on the traced site plan in 3D, with
   the neighbourhood from OpenStreetMap and HDB block heights; tap a stack to
   select it. Sun and shadows by date and time (4 pm shortcut), the View
   Clearance Floor Marker, block-to-block distances from the architect's
   brief, gates and the covered link to the MRT, renders, the location map,
   and a link to the Google 3D city view (website only).
2. **Plans.** Every floor plan, the elevation chart in the developer's unit
   type colours, and the site plan.
3. **Units & Payments.** Unit search and filters, the selected unit, the
   price-by-floor table and stack price chart, the payment estimate (loan by
   LTV, Buyer's and Additional Buyer's Stamp Duty by buyer profile,
   progressive payments by construction stage) and the comparison of up to
   three units.
4. **Schools.** Ai Tong School (highlighted, within 1 km), Catholic High,
   Ang Mo Kio Primary, CHIJ St. Nicholas Girls' and Marymount Convent, with
   OneMap distances from each block's address point.
5. **Investor.** JadeScape (Shunfu Road, about 1 km away) as the comparable:
   321 matched purchases and resales with profit by floor band, 881 rental
   contracts, the "fair guide" table, and the exit appeal score.
6. **Alternative Projects.** TRM's own comparison: Lentor Gardens Residences,
   Lentoria, Springleaf Residence and Chuan Park, with unit types, starting
   prices and units left from the Huttons API, compared size for size.
7. **PIVOT.** TRM's five scores (Product mix 9, Investment entry 8, Value-add
   10, Opportunity zone 8, Timing of exit 9; overall 8.8, the average), the
   entry-price workings ($1,178 + $700) × 1.15 × 1.15 = $2,484 psf, and the
   exit projection.
8. **My Upgrading Plan.** Valuation request and cash proceeds from selling a
   current home.

## 3. Commands

```
npm install             # install dependencies
npm run dev             # local site at http://localhost:3000 (/projects/thomson-reserve)
npm test                # unit tests (Vitest)
npm run typecheck       # TypeScript
npm run lint            # ESLint
npm run build           # production build
npm run build:artifact  # dist-artifact/selector.html, the single page

# Refresh availability and (once released) prices; needs HUTTONS_API_KEY and HUTTONS_API_SECRET
python3 scripts/huttons/sync-project.py "Thomson Reserve" src/features/selector/data/thomson-reserve/huttons-units.ts
# Refresh the alternatives' prices and units left
python3 scripts/huttons/sync-alternatives.py src/features/selector/data/thomson-reserve/alternatives-huttons.ts "Lentor Gardens Residences" "Lentoria" "Springleaf Residence" "Chuan Park"
```

Run `npm test`, `npm run typecheck` and `npm run lint` before every commit.
Never commit or print API keys; they come from the environment only.

## 4. Where things are

`src/features/selector/data/thomson-reserve/`:

- `bundle.ts` — the project bundle: facts, words, schools, JadeScape
  evidence, PIVOT, sources (each with kind, source, date and status) and the
  list of what is still missing. `entry.tsx` is its page.
- `index.ts` — blocks, stacks (traced from the site plan at 266 px = 100 m,
  plan north 40°), units, floor heights, gates, routes, noise sources, view
  rules, block distances.
- `unit-schedule.ts` — unit type for every stack and level, from the
  elevation charts.
- `floor-plans.ts` — unit type → floor plan image.
- `surroundings.ts` — landed estates, forest, view target.
- `gallery.ts` — renders (all "Artist's impression") and the location map.
- `huttons-units.ts` — every unit's availability and, once released, list
  and nett price (generated by `sync-project.py`; don't edit by hand),
  applied by `lib/listing.ts` so real prices replace the estimates.
- `alternatives.ts` and `alternatives-huttons.ts` — TRM's comparison page
  and its API prices (generated by `sync-alternatives.py`).
- `osm-context.ts` (from `scripts/osm/build-context.py`), `hdb-blocks.ts`
  (from `scripts/data/hdb-storeys.py`) and `map-context.ts` — the
  neighbourhood in 3D and the view obstructions (buildings of 4+ storeys with
  a recorded storey count; an OpenStreetMap footprint containing an HDB
  block's point takes HDB's storey count). Don't edit the generated files.

Elsewhere:

- `src/features/selector/data/comparables/jadescape.ts` (321 resales,
  Huttons report 22 Sep 2026) and `jadescape-rentals.ts` (881 leases,
  3 Oct 2026, from `scripts/data/rentals-from-csv.py`).
- `src/features/selector/model/` — `types.ts` (the data model; every value
  carries source, date and status) and `project.ts` (the bundle).
- `src/features/selector/lib/` — the calculations: `clearance.ts`,
  `solar.ts`, `exposure.ts`, `access.ts`, `estimate.ts`, `pricing.ts`,
  `recommend.ts`, `resale.ts`, `comparable.ts`, `scene.ts`, `payments.ts`,
  `stamp-duty.ts`, `progressive.ts`, `selling.ts`, `alternatives.ts`,
  `pivot.ts`, `rentals.ts`, `valuation.ts`, `listing.ts`, `project-check.ts`.
  Tests in `lib/__tests__/` (`thomson-reserve.test.ts` and others).
- `src/features/selector/components/` — the UI (`project-app.tsx` lays out
  the tabs; `site-3d.tsx` the 3D model; `charts.tsx` the shared charts).
- `src/features/city3d/city-3d.tsx` — Thomson Reserve in Google's
  Photorealistic 3D Tiles (CesiumJS; `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`;
  falls back to OpenStreetMap). Model from `scripts/3d/export-glb.mts` and
  `scripts/3d/site-outline.py` into `public/thomson-reserve/3d/`
  (`towers.glb`, `placement.json`). Website only.
- `public/thomson-reserve/` — site plan, its mask (white where the plan shows
  the site), floor plans, images.
- `src/app/projects/[slug]/page.tsx` (the page) and `src/app/selector/page.tsx`
  (old address, kept for shared links).
- `src/app/actions.ts` — enquiries and valuation requests post to
  `LEAD_WEBHOOK_URL`; the single page uses a stub that never reports a
  request as sent.
- `scripts/build-artifact.mjs`, `scripts/artifact/` — the single-page build.

## 5. Rules for Thomson Reserve

- Never invent figures. Unknown values stay unknown and are labelled.
- **Prices** are illustrative until the developer's price list is loaded:
  $2,850 psf at the lowest level plus $15 psf a floor. Every estimate is
  marked "est." and never presented as the developer's price. Real prices,
  once synced, replace the estimates.
- **View clearance** (TRM's on-site assessment): south-west-facing stacks
  clear the landed homes from level 5; north-east-facing stacks clear the HDB
  blocks from level 21; a stack facing another Thomson Reserve block must
  also clear that block's roof.
- **Starting floors:** homes start at level 1 in the Luxury blocks (5 and 7)
  and level 2 in the Classic blocks (1, 3, 9, 11); typical floors start at
  level 3.
- **Floor heights:** first homes at the brief's approximate heights above
  Upper Thomson Road (8.5 m Luxury, 14.5 m Classic); level 1 to 2 is 4.3 m
  (factsheet); other floors assumed 3.15 m.
- **Exit appeal**, out of 100: less competition (up to 50) plus the floor
  band's resale record at JadeScape (low 0, mid 10, high 30), out of 80,
  rescaled to 100. Distinctive features are not scored.
- **Alternative projects** are compared only on Thomson Reserve's bedroom
  types, at the standard estimate ($2,850 + $15), not the visitor's
  adjustments.
- Every page with figures carries the standard disclaimer
  (`NumbersDisclaimer`). Dollar amounts the visitor types use `AmountInput`
  (thousands separators).
- Label every render "Artist's impression".
- Do not commit developer PDFs. Never publish the project bank account
  details in the factsheet. No personal contact details on the site.
- Plain words for home buyers: "unit" for a home, "project" for a
  development; explain "stack" where it first appears. Buttons say what
  happens; errors give the problem, then the fix.
- Numbers-heavy tabs show their figures as charts as well as text and may
  carry a relevant project photo (Units, Investor, PIVOT and Upgrading do;
  Schools and Alternative Projects don't). The first tab stays as it is.
- Each tab opens with its one-line purpose; detail goes behind named
  expandable sections; a task ends with one suggested next step.
- Thomson Reserve's own rules live in its bundle, never in shared code.

## 6. Gotchas

- Next.js 16: read `node_modules/next/dist/docs/` before using a Next API.
  `next/image` uses `preload` or `loading="eager"`, not `priority`.
- The plan is rotated: use `project.planNorthDeg` (40°) for every bearing,
  sun vector and compass.
- The OpenStreetMap layer is fitted to the site plan at the scale bar
  (2.66 px/m), rotated 40°, shifted so MRT Exit 2 lands on the plan's
  marker. To refresh it, export a `.osm` from openstreetmap.org locally (the
  cloud network policy blocks it) and run
  `python3 scripts/osm/build-context.py map.osm`. Keep the "© OpenStreetMap
  contributors" credit on screen.
- The single page only shows images embedded in it: the build turns every
  image into a data URI (`scripts/artifact/embed_assets.py`). Use `AssetImg`,
  not `<img>`. Test it under a strict CSP (`img-src data: blob:`), not by
  opening the file from disk.
- Browser tests in cloud sessions: Chromium at `/opt/pw-browsers/chromium`
  with `--use-angle=swiftshader` for WebGL.
- CesiumJS needs `forwardAxis: Axis.X` for the towers model, or it turns it
  to face east. Re-run both 3D scripts after changing blocks or stacks.

## 7. Still missing

- The developer's price list (prices are illustrative until 31 Oct 2026),
  payment schedule and maintenance fee estimates.
- Surveyed heights of the landed homes, trees and the HDB blocks to the
  north-east, to confirm view clearance stack by stack; exact finished floor
  levels; walked routes inside the development; room facings per unit plan.
- MOE home-school distances by address, and past P1 registration results.
- The official URA land tender record for the $810M bid; how the e-book's
  8.6/10 PIVOT overall was worked out (the five scores average 8.8);
  confirmation of the JadeScape facts in the fair-guide table.

## 8. How to rebuild it from scratch

1. **Create the app:** `npx create-next-app@latest` with TypeScript,
   Tailwind, ESLint and the App Router. Add `three`, `@react-three/fiber`,
   `@react-three/drei`, and dev tools `vitest`, `esbuild`, `@tailwindcss/cli`.
2. **Brand:** Archivo and Newsreader on a dark green and mist palette, colour
   tokens in `globals.css`; header, footer, home page.
3. **Data model first:** project, blocks, stacks, layouts, units,
   obstructions, view targets, routes, noise sources, each with provenance.
4. **Calculations with tests:** geometry and floor heights, sun (NOAA
   formulas), view clearance (sight lines over obstructions), noise
   screening, MRT walk, pricing, recommendations, exit appeal, payments and
   stamp duty.
5. **Load Thomson Reserve:** trace each stack from the site plan (266 px =
   100 m, north 40°); build the unit type for every stack and level from the
   elevation charts; sizes, storeys and heights from the factsheet; one floor
   plan image per type. Check the total is 1,268 homes.
6. **Local knowledge:** surroundings and the view rules above, gates and the
   65 m covered link, renders, the location map, illustrative prices, the
   OpenStreetMap neighbourhood and HDB heights, JadeScape evidence, PIVOT.
7. **The UI:** the eight tabs above; check every screen at phone width.
8. **Share it:** `npm run build:artifact` and publish
   `dist-artifact/selector.html` as an Artifact, or deploy with `vercel`.
9. **Before go-live:** run `sync-project.py` to load the price list and
   availability, connect enquiries (`LEAD_WEBHOOK_URL`), confirm the agency
   details.
