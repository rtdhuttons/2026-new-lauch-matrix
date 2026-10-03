# Adding a project

The website and its calculators are shared. A development is added by
giving it its own data folder; nothing in the shared code changes.
Thomson Reserve (`src/features/selector/data/thomson-reserve/`) is the
worked example, and `src/features/selector/data/demo/` is a fictional
sample project that proves nothing from Thomson Reserve leaks into another.

Start with `docs/project-intake-checklist.md` to gather the material.

## 1. Files to create

```
src/features/selector/data/<project-id>/
  index.ts      blocks, stacks, units, heights, gates, routes, noise sources, view rules
  bundle.ts     the ProjectBundle: facts, words, media, pricing, schools, evidence, sources, gaps
  entry.tsx     three lines: renders <ProjectApp project={bundle} /> and the footer
  gallery.ts    renders and location map (optional); pick tab photos
                from these in bundle.ts (media.tabPhotos, optional)
public/<project-id>/
  site-plan.jpg, site-plan-mask.png, plans/*.jpg, images/*.jpg
```

Then register it in two places:

- `src/features/selector/data/projects.ts`: one entry with its id, name,
  `status` (`"live"` or `"sample"`), home-page card and
  `load: () => import("./<project-id>/entry")`.
- `scripts/artifact/projects.mjs`: its entry file, output name, image
  folders and site plan, for the single-page (Artifact) build.

The page is then at `/projects/<project-id>`, and
`TRM_PROJECT=<project-id> npm run build:artifact` builds its single page.

## 2. The bundle

`src/features/selector/model/project.ts` documents every field. Key rules:

- **Never invent a figure.** Leave a value `null` or a list empty and the
  website shows "Not added yet" with what's needed.
- **Project rules live in the bundle**, never in shared code:
  - starting floors: `firstResidentialLevel` on each block
  - view-clearance assessments: `observedClearance` on each stack
  - illustrative pricing: `pricing.estimate`
- **Sources:** add a line to `sources` for each important fact, with its
  kind (developer, official, third-party, agent, calculated, illustrative)
  and the date it was checked.
- **Gaps:** list what's missing in plain words in `gaps`.
- **Sample projects** use `status: "sample"` and say "Sample" or
  "fictional" in their opening words; they are never listed or published.

## 3. Manual geometry preparation

This is the one part that needs hands-on work. Allow half a day per project.

1. **Scale and north.** Measure the site plan's scale bar in pixels
   (Thomson Reserve: 266 px per 100 m) and read the north point's bearing
   (Thomson Reserve: plan "up" is 40° east of true north →
   `planNorthDeg: 40`).
2. **Plan coordinates.** Convert pixels to metres with `P(px, py)`
   (pixels ÷ px-per-metre). x grows to the right, y grows down the plan.
3. **Blocks and stacks.** For each block, record its centre, rotation and
   footprint. For each stack, record its position from its label on the plan,
   the facing of the living room and master bedroom, and its unit type.
4. **Unit schedule.** From the elevation charts, list the unit type for every
   stack and floor, including PES units on the lowest floor and floors without
   homes (sky terraces). Check the total against the factsheet.
5. **Heights.** Set each block's ground level, level 1 height and typical
   floor-to-floor height. If only heights above a road are known, say so in
   `heightDatum`.
6. **Floor plans.** Export one image per unit type from the unit plans and map
   each type code to its image; note mirrored stacks.
7. **Site plan mask (optional).** A greyscale PNG, white where the plan shows
   the site, so the neighbourhood map shows around it.
8. **Neighbourhood (optional).** Export an `.osm` file from
   openstreetmap.org and adapt `scripts/osm/build-context.py`: set the fit
   (rotation, scale, shift) so a known landmark, such as an MRT exit, lands on
   its marker on the plan. Keep the "© OpenStreetMap contributors" credit.

## 4. Evidence files

- Rental contracts: `python3 scripts/data/rentals-from-csv.py RENTALS.csv
  --project "<name>" --export <name>Rentals --out src/features/selector/data/comparables/<name>-rentals.ts
  --source "..." --as-at YYYY-MM-DD`
- Resale records: follow `src/features/selector/data/comparables/jadescape.ts`
  (one row per matched purchase and sale; set `bedroomsInferred` honestly).

## 5. Check before publishing

```
npm test           # includes checkProject() on every registered bundle
npm run typecheck
npm run lint
npm run dev        # open /projects/<project-id>
```

`checkProject()` (`src/features/selector/lib/project-check.ts`) reports
errors (units on unknown stacks, totals that don't match, undated sources)
and lists the optional sections still missing. Add your bundle to the
"project bundles" tests in `lib/__tests__/template.test.ts`.
