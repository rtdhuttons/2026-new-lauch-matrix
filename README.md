# TRM — The Realty Master

Next.js 16 + TypeScript + Tailwind CSS v4 site for TRM.

| Route | What it is |
|---|---|
| `/` | TRM landing page (Thomson Reserve project page in progress) |
| `/selector` | **Stack & Unit Selector** prototype — illustrative demo data for a fictional project |

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # calculation tests (Vitest)
npm run lint && npm run typecheck
```

## Claude Code setup

Project plugins are enabled in `.claude/settings.json` and extra MCP servers are in `.mcp.json`, so they load in any checkout.

| Plugin / server | Use | Needs |
|---|---|---|
| frontend-design, ui-ux-pro-max, impeccable | Design direction and critique | — |
| modern-web-guidance | Current web performance and accessibility practice | — |
| figma | Design tokens from Figma | Figma sign-in |
| 21st | Component search | `API_KEY_21ST` |
| context7 | Up-to-date library docs | optional `CONTEXT7_API_KEY` |
| vercel | Deploys, preview links, logs | Vercel sign-in. Anonymous usage telemetry; set `VERCEL_PLUGIN_TELEMETRY=off` to disable |
| supabase | Database for registrations and saved shortlists | Supabase sign-in |
| mapbox | Maps and walking routes | Mapbox sign-in / token |
| playwright (`.mcp.json`) | Browser checks and screenshots | — |
| shadcn, aetumi, blender (`.mcp.json`) | Components, 3D components, Blender | Blender desktop app for blender |

Playwright runs through `scripts/playwright-mcp.sh` instead of the marketplace plugin: in Claude Code cloud sessions it uses the preinstalled Chromium, headless, and elsewhere it uses Playwright MCP's defaults. The plugin version is disabled because it only looks for Google Chrome.

In cloud sessions, remote servers only connect if their hosts are allowed in the environment's network access (for example `mcp.context7.com`, `mcp.figma.com`, `mcp.vercel.com`, `mcp.mapbox.com`, `mcp.supabase.com`, `21st.dev`, `mcp.aetumi.app`).

## Stack & Unit Selector

The selector runs on **Thomson Reserve** (`src/features/selector/data/thomson-reserve/`). Its layout is traced from the developer's site plan (`public/thomson-reserve/site-plan.jpg`): six blocks (Classic 1, 3, 9, 11 at 21 storeys; Luxury 5, 7 at 30 storeys) and stacks 01–55, with the plan's own scale bar and north point (plan up is 40° east of north). Classic blocks place exactly the reported 740 homes. Prices, unit types and availability are shown as "awaiting price list"; neighbouring building heights are not loaded, so view clearance is "not assessed". The known gaps are listed in the dataset and on the page. The fictional Wrenfield Residences demo (`data/demo/`) remains for tests.

Helps a buyer decide which stack and floor suit them, what changes as they move up, and whether the extra price for a better floor, facing or view is worth paying. **Every figure is illustrative demo data for "Wrenfield Residences", a fictional project.**

### Where things live

```
src/features/selector/
  model/types.ts        Data model. Every record carries Provenance {source, updated, status}
  data/index.ts         The one switch that chooses the dataset
  data/demo/            Fictional demo data, one module per kind:
    project.ts            project, blocks, layouts, stacks
    units.ts              price list and availability
    surroundings.ts       obstructions, view targets, future development sites
    access.ts             noise/privacy sources, gates, walking routes
    market.ts             nearby projects; transactions (deliberately empty)
  lib/                  Pure calculations (tested in lib/__tests__)
    clearance.ts          View Clearance Floor Marker
    solar.ts              Sun exposure (replaceable SunProvider)
    exposure.ts           Noise & privacy screening
    access.ts             MRT walking access
    pricing.ts            Premiums, per-floor premium, cost to reach clearance
    resale.ts             Resale competition
    engine.ts             Caches and combines assessments per unit
    recommend.ts          Essentials filter, lifestyle fit, recommendations
    scenario.ts           Premium & resale scenario calculator
    scene.ts              3D massing built from the dataset (tested)
  components/           UI: 3D site view (three.js / react-three-fiber, loaded client-only),
                        flat plan, floor slider + elevation, tabs, comparison, calculator
```

### Site view

The site plan opens as a 3D view: every unit is its own box, coloured by bedroom type, within budget, view clearance or availability. Drag to spin, pinch or scroll to zoom, and tap a unit to see its price and move the floor slider to it. "Surroundings" shows neighbouring buildings, trees, roads and water; "Sun & shadows" casts real Singapore sun positions (play the day, pick Mar/Jun/Sep/Dec). The compass turns with the view and resets it. "Flat plan" keeps the 2D plan with its view, noise, privacy, route and future-development overlays, and is the keyboard-accessible route along with the stack list.

### The six frameworks

1. **Entry price & premium** — total price, area, PSF, premium over a buyer-chosen reference unit, and per-floor premium only for the same layout in the same stack. Layout, size and feature differences are flagged. Prices exist only for available units; sold, reserved and unreleased units never get an interpolated price.
2. **Sun exposure & facing** — living room and master bedroom facings recorded separately. Real sun positions (NOAA approximation) for Singapore's latitude, with simplified shading from balcony overhangs and nearby buildings. Month and time controls. Labelled as an illustrative geometric estimate; any provider returning the same `ExposureEstimate` can replace it.
3. **View Clearance Floor Marker** — *the estimated first floor where the main view clears a nearby obstruction.* Five sight lines are cast across the main view. For each, the eye level needed to see the view target (anywhere in its first 300 m) over every obstruction is solved from distances and elevations above datum: ground level, level 1 height and floor-to-floor height. The floor number alone never decides clearance. Obstruction heights are ranges, so the marker becomes a floor range when the height is uncertain. Categories: below obstruction (no lines clear), partially cleared (some), estimated clear view (≥ 4 of 5), clear with limited further gain (all 5, 3+ floors above the clearance floor). Future view risk is reported separately.
4. **Noise & privacy** — qualitative screening only (higher / moderate / lower potential) from distance, which rooms face the source, and whether a building blocks the line at *that floor*. No decibel figures, and no assumption that higher floors are quieter.
5. **MRT access** — recorded walking routes (block → gate → MRT entrance), minutes at 80 m/min, covered length where known; straight-line distance shown only for comparison.
6. **Resale competition** — count of similar units (same bedrooms, area within 10%) in the development, how many share the unit's view category, distinctive benefits and nearby comparable projects. No returns, demand or days-on-market without transaction data ("insufficient evidence").

### Recommendation rules

- Essentials first: available, within budget, matching bedrooms, and optionally an estimated clear view.
- **Lifestyle fit** = weighted average of criterion scores using only criteria with data. Coverage is shown; unknown values are never averaged in.
- **Best fit for your lifestyle**: highest fit within the extra-spend limit with ≥ 70% coverage.
- **Lowest entry price**: cheapest eligible unit.
- **Best supported value**: most fit points gained per $10,000 above the lowest entry price, among units with ≥ 80% coverage, a view category that is not uncertain at that floor, and ≥ 5 fit points gained. Otherwise the lowest entry unit.
- Appreciation potential is never ranked without verified repeat-sale transactions.

Criterion scores are defined in `lib/engine.ts`, `lib/exposure.ts`, `lib/access.ts` and `lib/resale.ts`, and explained on the page under "Method and data".

### Scenario calculator

```
size-adjusted base = reference PSF × compared area
premium            = compared price − size-adjusted base
reference resale   = reference price × (1 + g)^n
compared resale    = (base + premium × retained share) × (1 + g)^n
required resale    = compared price × (reference resale ÷ reference price)
```

Market growth is applied once; the retained share applies only to the premium, so the premium is never counted twice. Net gain subtracts BSD (residential bands), ABSD, legal fees, loan interest, holding costs, agent fees and SSD (default 16/12/8/4% for years 1–4, homes bought from 4 July 2025; check IRAS). Downside, base and upside presets are assumptions, not forecasts.

### Real data needed to replace the demo

- **Project and blocks**: site plan with block footprints, stack positions and north point; elevation levels (ground RL, level 1 and typical floor heights, roof, sky terraces); unit schedule by stack with layout, strata area and living/master facings.
- **Prices**: current price list for released units and live availability with update dates.
- **Surroundings**: neighbouring building footprints and heights (survey, URA 3D model or storey counts), surveyed tree canopy heights, view target levels and distances, and Master Plan zoning and approved developments for future risk.
- **Sun**: balcony, ledge and fin depths and window heights per layout; ideally a verified solar simulation.
- **Noise, privacy and access**: facility, ramp and walkway positions; road alignments and any measured noise data; gates, opening hours, and walked MRT routes with covered sections.
- **Market**: nearby comparable projects by bedroom type and size, and verified transactions (unit, date, price) for like-for-like and repeat-sale analysis.

## Thomson Reserve

Public research notes are in `docs/research/thomson-reserve.md`. The developer PDFs on the Huttons portal could not be opened from the build environment; figures marked unverified there must be checked against the factsheet before publishing.
