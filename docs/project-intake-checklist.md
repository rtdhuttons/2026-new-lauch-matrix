# Project intake checklist

What to gather for each new development before it goes on the TRM website.
Every item maps to a field in the project bundle
(`src/features/selector/model/project.ts`). Anything you can't supply yet
stays empty, and the website shows "Not added yet" instead of guessing.

For each item, note **where it came from** and **the date you checked it**.
The website keeps these kinds of information apart:

| Kind | Examples |
|---|---|
| Developer information | Factsheet, brochure, site plan, elevation charts, unit plans, renders, price list, payment schedule |
| Official record | URA land tender, URA transactions, MOE registration results, SLA OneMap distances, IRAS rules |
| Research or map data | Huttons research reports, OpenStreetMap, property portals |
| TRM assessment | Your on-site observations, view clearance checks, PIVOT scores |
| Calculated estimate | Worked out by the website (traced positions, sun, heights) |
| Illustrative assumption | Placeholder prices until the price list is out |

Sample files showing the expected layout are in `docs/sample-project/`. All
their values are fictional.

---

## 1. Project facts and contact details

| Provide | From | Used for |
|---|---|---|
| Project name, street address(es), district | Factsheet | Opening screen, school distances |
| Developer (and joint-venture partners) | Factsheet | Project facts |
| Tenure and lease start date | Factsheet | Project facts, alternatives |
| Total units, blocks and storeys | Factsheet | Checks against the unit schedule |
| Site area and plot ratio | Factsheet | PIVOT land-cost working |
| Expected vacant possession (TOP) and legal completion dates | Factsheet | Payment timeline, PIVOT exit |
| Nearest MRT station and walking link | Brochure, architect's brief | Facts, walking times |
| 3–4 headline facts for the opening screen | You | Opening screen |
| Disclaimer wording for this project | You | Footer |

Agency-wide details (the site is generic: no personal contact details are needed)
are set once in `src/content/site.ts`, not per project.

Never include the project's bank account details.

## 2. Site plan, north point, blocks, stacks, floors and units

| Provide | From | Notes |
|---|---|---|
| Site plan image with a scale bar and north point | Developer | High resolution; the plan is traced by hand (see `docs/adding-a-project.md`) |
| Block names, storeys, and which floors have homes | Elevation charts, factsheet | E.g. "homes start at level 2"; sky terraces and floors without homes |
| Floor heights: ground level, level 1 height, typical floor-to-floor | Architect's brief, sections | Used for views and sun; mark estimates as estimates |
| Unit type for every stack and floor | Elevation charts | One row per stack: type by floor (see `sample-project/unit-schedule.sample.csv`) |
| Gates, drop-off, car park entrances | Site plan | Walking routes and noise |

## 3. Floor plans, areas and bedroom types

| Provide | From |
|---|---|
| One floor plan image per unit type (and which stacks are mirrored) | Developer's unit plans |
| Strata area (sq m and sq ft) and bedroom count for each type | Factsheet or unit plans |
| Special features: PES, private lift, study, dual key | Unit plans |

## 4. Images and 3D surroundings

| Provide | From | Notes |
|---|---|---|
| Opening image and gallery renders, with a short caption each | Developer | Every render is labelled "Artist's impression" |
| Location map | Developer | |
| Neighbourhood export (`.osm` file) | openstreetmap.org → Export | Optional; draws surrounding buildings and roads |
| Heights of buildings that block views | Survey, URA, or storey counts | Unknown heights stay unknown |

## 5. Prices and availability

| Provide | From | Notes |
|---|---|---|
| Dated price list: unit number and price | Developer | Replaces all illustrative prices (see `sample-project/price-list.sample.csv`) |
| Availability: available, reserved, sold, not released | Developer | With the date it was checked |
| Payment schedule (stages and percentages) | Developer | Payment timeline |
| Maintenance fee estimates | Developer or managing agent | Ongoing costs |
| Illustrative pricing assumption, if no price list yet | You | Lowest-floor PSF and step per floor; always shown as an estimate |

## 6. Facing, view clearance and site observations

| Provide | From |
|---|---|
| Your on-site view clearance findings, by facing or stack, with the date | TRM assessment |
| Notes on noise sources, privacy and future developments nearby | TRM assessment, URA Master Plan |

## 7. Schools, comparison projects, transactions and rental evidence

| Provide | From | Notes |
|---|---|---|
| Schools to show, and which to highlight | You, developer's location map | |
| Official home–school distance for the address | SLA OneMap | One per primary school |
| Past Primary 1 registration results by phase | MOE | Places, applicants, balloting, by year |
| Comparison projects and why each is relevant | You | Same district, developer scale, MRT, landed neighbours |
| Matched purchase-and-sale records for each comparison project | URA Realis / Huttons report | Floor, size, bedrooms (say if inferred), dates and prices |
| Rental contracts | URA Realis / Huttons report | Month, size band, rent, bedrooms where recorded (`sample-project/rentals.sample.csv`) |
| Alternative projects: name, role, why relevant, nearest MRT, total units, tenure, completion, and for each unit type its bedrooms, size range, starting price and units left, with the date | You, portals, URA | Say what the price is (e.g. lowest price among units still available) — see `sample-project/alternatives.sample.csv` |

## 8. PIVOT inputs and project-specific assumptions

| Provide | From |
|---|---|
| Scores and reasons for Product mix, Investment entry, Value-add, Opportunity zone, Timing of exit | TRM assessment |
| How the overall rating is worked out | TRM |
| Land tender price and price psf ppr | URA tender record |
| Construction cost, margin and breakeven assumptions | TRM |
| Resale records of a comparable completed project (purchase and sale prices and dates), for the average CAGR used in the exit strategy | Huttons transaction report, URA |

---

## Before publishing

- [ ] `npm test` passes, including the project check for this bundle.
- [ ] Unit totals match the factsheet.
- [ ] Every source has a checked date.
- [ ] Renders say "Artist's impression"; estimates say "Estimate".
- [ ] No bank account details, no personal financial information.
- [ ] Enquiries are connected (`LEAD_WEBHOOK_URL`) on the deployed website.
