# TRM design guide

How the TRM website and the new launches map look and behave, so another
build matches them. The source of truth is the code: `src/app/globals.css`
(tokens), `src/features/selector/components/` (project pages) and
`src/features/catalogue/components/projects-map.tsx` (the map). If you can
use the code, use it rather than rebuilding from this description.

Live references:
- Thomson Reserve: https://claude.ai/artifact/5kRAW7usFiDUPDepbFZjSP
- The Serra Residences: https://claude.ai/artifact/4Ym1GFYpmJDWMDQkwmnSyf
- Arina East Residences: https://claude.ai/artifact/89wwTydUfsVZ9tBif1r3e5
- New launches map: https://claude.ai/artifact/YFGLzQ7isd2FsQUmNKUR3y

## 1. Character

Calm, editorial and trustworthy, like a well-made property report rather
than a sales brochure. A dark forest green and a pale mist background, an
expanded grotesque for names and headings, a book serif for reading. Few
colours, generous space, numbers shown as charts as well as text. Every
figure carries its source and date; estimates are marked "est.".

## 2. Colour tokens

| Token | Hex | Use |
|---|---|---|
| canopy | `#10291c` | Text, dark buttons, active tab, table headers |
| canopy-soft | `#1c3a2a` | Hover on dark surfaces |
| mist | `#edf0ea` | Page background; selected rows |
| mist-deep | `#dfe4dc` | Dividers on mist, subtle fills |
| reservoir | `#2e6a78` | Links, focus ring |
| reservoir-light | `#9cc2cb` | Light accents |
| stone | `#6f7a71` | Small print, sources |
| paper | `#ffffff` | Cards |

Accents used sparingly:
- Warning or "only N left": burnt red `#9b3b1c`.
- Notes and "work in progress" boxes: amber left border `#c88a12` on `#fbf5e8`.
- Chart series, in order, checked for colour-blind readers: `#0b7f9e`,
  `#c77a12`, `#7a4fb5`, `#d0457a`, `#5b8f22`. Chart ink `#10291c`, muted
  `#6f7a71`.

Text on canopy is mist or white. Muted text is canopy at 65–85% opacity
(`text-canopy/70`), never grey on grey.

## 3. Type

- **Archivo**, expanded (width 125%, `font-stretch: 125%`) and extra bold
  for project names, section headings and big numbers (`.font-display`).
- **Archivo** at normal width (`.font-display-normal`) for buttons, labels,
  tabs, tables and chart text.
- **Newsreader** (serif) for body text and explanations.
- Loaded from Google Fonts: `Archivo:wdth,wght@62..125,100..900` and
  `Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800`.
- Scale (ratio 4:3 from an 18px base): small 13px, base 18px (line height
  1.6), lg 24px, xl 32px, 2xl 42px. Hero project names are 48–80px.
- Small caps-style labels: 12px, semibold, uppercase, letter-spacing 0.06–0.1em.

## 4. Shapes and layout

- Cards: white, `rounded-xl` (12px), 1px border in canopy at 10% opacity, no
  heavy shadows. Padding 20–24px.
- Buttons: the one main action is a dark pill (canopy fill, mist text,
  fully rounded); secondary actions are outlined pills or underlined text.
  Buttons say what happens ("Add to comparison", "Calculate payments").
- Toggles and filters are pill groups; the chosen one is filled canopy.
- Tables: canopy header row with mist uppercase labels, thin dividers, right-
  aligned tabular numbers; on phones they become stacked cards.
- Max content width about 1280px with 16–32px side gutters; everything works
  at 390px wide with no sideways scroll.
- Focus ring: 2px reservoir outline, 3px offset. Respect reduced motion.

## 5. Project page

- **Hero**: full-width render with a dark gradient, eyebrow line (address ·
  area, uppercase, tracked), the project name huge in expanded Archivo, a
  one-line promise ("Choose the right unit, not just the right project."), a
  short serif paragraph, a white pill "Find my unit", an outlined "See the 3D
  site", an underlined "Investing? View investment analysis", then four key
  facts in a row (Units, Units left or Tenure, Estimated price from, MRT
  walk). Caption "Artist's impression" bottom right.
- **Eight tabs**, always in this order, in a sticky bar under the hero:
  Project & 3D Site, Plans, Units & Payments, Schools, Investor, Alternative
  Projects, PIVOT, My Upgrading Plan. The active tab is a filled canopy pill.
  "My Shortlist (n)" sits at the right of the bar.
- Each tab opens with a large heading and its one-line purpose in serif;
  detail sits behind named expandable sections ("View rent tables", plus
  icon on the right); each tab ends with one suggested next step and
  Previous/Next section cards.
- Numbers-heavy tabs show charts as well as text (line, bar, scatter,
  waterfall, split bar), each in a white card with a title, a one-line
  subtitle, a legend when there is more than one series, hover tooltips and
  a "Show the numbers" table.
- A project photo band may break up the Units, Investor, PIVOT and
  Upgrading tabs (not Schools or Alternative Projects).
- Every page with figures ends with the amber-bordered "Important:"
  disclaimer box. Footer: TRM wordmark left, "Contact a Huttons Associate"
  right, small serif source note.

## 6. 3D site

Blocks as extruded boxes on the developer's site plan laid flat at true
scale, rotated to plan north; each unit is a box you can tap; the chosen
stack is highlighted; sun and shadows by date and time with a "See shadows
at 4pm" shortcut; neighbouring buildings from OpenStreetMap as light grey
blocks; block-to-block distances drawn as thin lines with labels; compass
and "© OpenStreetMap contributors" on screen.

## 7. The new launches map

- Drawn as SVG (no map tiles), Singapore's URA market regions at subzone
  level over a pale sea:
  - Sea `#EAF2F5`; parks `#cfe6c8` at 85%; water `#c7dde8`; major roads white
    with a `#dcd6ca` hairline.
  - CCR lavender `#E9DDF7` with purple accent `#7952B3`; RCR peach `#FBE3CA`
    with burnt orange `#B96524`; OCR teal `#D8EEE7` with deep teal `#247C69`.
- Markers: compact navy (`#14284b`) map pins with a white outline and a tiny
  white building glyph, for "New launch" and "Upcoming" only (sold-out,
  resale and projects launched before 2020 are not shown). Close markers
  merge into white circles with a navy ring and the count in bold navy.
- Labels are placed without collisions: region and neighbourhood names at
  the overview, district numbers (D01–D28) as you zoom in.
- A floating region filter (All regions · CCR · RCR · OCR) that zooms the map
  to fit; grouped zoom and reset buttons with 44px touch targets; a "Price
  heatmap" view shading districts by average psf with its own legend.
- Hover or tap a district for a small card with region shares and listing
  count. Choosing a project opens a compact card with its photo, prices by
  unit type, nearby projects to compare and URA sales and rents around it,
  plus a link to its guide.
- Above the map: search, bedrooms and budget filters, "New launch" and
  "Upcoming" toggles, and "97 of 97 projects shown". Below it: a sortable
  table of all matching projects (project, region chip, district, bedrooms,
  from price, units left, type).

## 8. Words

Plain words for home buyers: "unit" for a home, "project" for a
development; explain "stack" where it first appears. Errors give the problem,
then the fix. Label every render "Artist's impression". Never invent a
figure: unknown values say "Not known yet" or "Not released".
