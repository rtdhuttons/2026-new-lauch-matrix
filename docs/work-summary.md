# TRM website — summary of work so far

Project: the TRM (The Realty Master) website, with its Thomson Reserve Stack
& Unit Selector. Work done 30 September – 1 October 2026.

- Live page: https://claude.ai/artifact/5kRAW7usFiDUPDepbFZjSP (shared with
  anyone who has the link)
- Code: GitHub `rtdhuttons/2026-new-lauch-matrix`, branch
  `claude/web-dev-plugins-setup-y5ynix` (33 commits)

---

## 1. Set-up

- Installed the design and web-building plugins for Claude Code (frontend
  design, UI/UX Pro Max, Impeccable, 21st.dev, Figma, Vercel, Supabase,
  Mapbox, Context7, modern web guidance) and the browser-testing, shadcn,
  AETumi and Blender tools.
- Built the TRM website: home page, header, footer and brand colours and
  fonts.

## 2. The Stack & Unit Selector

A buyer's tool for choosing a home at Thomson Reserve, covering six
questions for every home:

1. **Price and premium:** what each floor costs and the extra paid per floor
2. **Sun and facing:** which way the living room faces and how much afternoon
   sun it gets
3. **View Clearance Floor Marker:** the first floor where the view clears
   what's in front of it
4. **Noise and privacy:** nearby roads, pools and courts, and facing windows
5. **MRT access:** walking time to Upper Thomson MRT
6. **Resale competition and exit appeal:** how many similar homes compete
   when you sell

## 3. Loaded the real Thomson Reserve

- **Site plan:** all 6 blocks and 55 stacks placed on the developer's site
  plan at true scale, with the north point.
- **Unit types:** every stack and level from the developer's elevation
  charts — 1,268 homes, matching the factsheet.
- **Floor plans:** one plan per unit type from the developer's unit plans.
- **Architect's brief:** ground levels, gates, the 65 m covered link to the
  MRT, outlooks and the surrounding landed estates.
- **Your on-site view rule:** south-west-facing homes clear the landed homes
  from level 5; north-east-facing homes clear the blocks across Bright Hill
  Drive from level 21; a home facing another Thomson Reserve block must also
  clear that block's roof.
- **Starting floors (factsheet):** level 1 in the Luxury blocks (5 and 7) and
  level 2 in the Classic blocks (1, 3, 9 and 11).

## 4. Features added at your request

- **3D model:** spin, zoom, tap a home, colour by bedroom type, budget, view
  or sun. Sun and shadows for any time of day, plus a "See shadows at 4pm"
  shortcut.
- **Selected-home panel:** price, size, PSF, floor up/down, facing, view, MRT
  walk and floor plan.
- **Unit search** (e.g. #12-25), **block labels** and a **facing summary**.
- **Illustrative prices:** $2,850 psf at the lowest level plus $15 psf a
  floor, both editable, or set by average PSF. Every estimate is marked
  "est."
- **Price-by-level table** in the pricexstack style: every level with its
  PSF, a column per unit type and an AVG marker.
- **Photos:** 13 renders and the location map you sent, all labelled
  "Artist's impression".
- **Location section:** MRT, nature, schools, food and shopping.
- **Simpler layout** after your feedback that it was cluttered: filter chips,
  the 3D model with a dark selected-home panel beside it, and the detail
  folded away until needed.
- **Profit by floor band** from the 321 JadeScape resales you sent: low, mid
  and high floor results, a chart of every resale, and why JadeScape is a
  fair guide. This also feeds each home's exit appeal score.
- **Removed** at your request: the level 1–30 tower and the Premium & resale
  scenarios section.
- **Footer** now says "Contact a Huttons Associate".
- **OpenStreetMap neighbourhood** from the map file you uploaded: about
  1,000 nearby buildings, roads with names, parks and water around the 3D
  model. It confirmed 21-storey blocks at 41, 43 and 45 Bright Hill Drive,
  which matches your level 21 finding.

## 5. Fixes

- **Images missing on phones:** every image is now built into the shared
  page, so they show everywhere.
- **Sideways scrolling on phones:** fixed on every section.
- **3D view going blank when zoomed out:** fixed.
- **Exit appeal scores of 0 for most homes:** rescaled so the scores spread
  sensibly.

## 6. Documents written

| File | What it is |
|---|---|
| `CLAUDE.md` | Plugins to install, commands, project rules and a 10-step guide to building the site from scratch |
| `docs/how-to-use.md` | A plain-words guide for buyers using the selector |
| `docs/website-content.md` / `.txt` | All the text on the website, page by page |
| `docs/work-summary.md` | This summary |

## 7. Checks

- 53 automated tests pass (prices, view clearance, sun, JadeScape figures,
  map placement and more); typecheck and lint are clean.
- The shared page was tested on desktop and phone widths, under the same
  image restrictions claude.ai uses.

## 8. House rules followed

- No figures are invented: unknowns are labelled, and estimates are marked
  "est."
- Developer PDFs are not stored in the code, and the project bank account
  details are never published.
- The OpenStreetMap login you shared was not used. Please change that
  password if you haven't already.

---

## Still needed from you before go-live

1. The agent's name, CEA registration number, phone/WhatsApp and email (for
   the footer)
2. The developer's price list and availability (these replace all the
   estimates)
3. Confirmation of the JadeScape facts in the comparison table

## Optional next steps

- Show the OpenStreetMap neighbourhood on the flat plan as well
- Deploy the full website on Vercel with its own web address (the Vercel
  connection is currently blocked by this environment's network settings)
