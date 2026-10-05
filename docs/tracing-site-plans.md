# Tracing a project's site plan

Each project on the new launches map has a mini site built automatically
from the Huttons New Launch API (`scripts/huttons/build-sites.py` writes
`src/features/selector/data/auto/specs/<slug>.json`). Until its site plan is
traced, the 3D model is schematic and facings are "not known yet". A trace
puts every block and stack where the developer's plan shows them, at the
plan's scale and north point, so the 3D site, facings and sun work as they do
for Thomson Reserve.

## Steps

1. `python3 scripts/trace/trace_tools.py prep <slug>`
   Downloads the site plans and elevation chart into `.trace/<slug>/`, draws a
   labelled pixel grid over each (`grid-<n>.jpg`), and lists the blocks and
   stacks from the unit list. Open the grid images. Grid labels are in the
   **original image's pixels** even though the preview is scaled.
2. Pick the image that is the site plan (usually "Site Plan"). Use
   `zoom <slug> <n> x0 y0 x1 y1` for close-ups (finer grid, original pixels).
3. Read, in original pixels:
   - **Scale**, in this order of preference (`scaleFrom`):
     1. "scale bar": the scale bar's 0 tick and its last tick; `pxPerM` =
        pixel distance ÷ metres.
     2. "site area": trace the site boundary (the plot's outer line) as a
        polygon in `siteBoundary`, then run
        `trace_tools.py scale <slug> x1,y1 x2,y2 ...` with the same points;
        it divides the polygon's area by the site area the developer
        publishes. Only when the whole plot is shown and its boundary is
        clear.
     3. "known dimension": a standard tennis court (23.77 m long) or a lap
        pool whose length the developer states. Say which in `notes`.
     If none of these works, do not guess: skip the project.
   - **North**: the direction the north arrow points, as degrees clockwise
     from straight up on the image. `northDeg` = 360 − that angle (so an
     arrow leaning 31° right gives 329; leaning 12° left gives 12). If the
     plan has no north point, set `"northDeg": null`: the layout is still
     placed to scale, and the site says facings are not known.
   - **Blocks**: for every block name in the unit list (e.g. "Blk 32"), the
     centre of the block (its lift core, often where the block number is
     printed) as `core`.
   - **Stacks**: where stack numbers are printed on the plan, the centre of
     each number as that stack's position (`stackPositions: "labelled"`).
     Where they are not, place each stack on the side of its block that the
     floor plans' key plans or the unit distribution diagrams show; if that
     can't be told, leave `stacks` out for that block (the site arranges them
     round the core) and use `stackPositions: "arranged"`.
   - **Crop**: the rectangle `[x0, y0, x1, y1]` that is the plan itself,
     leaving out legends, titles and other panels.
4. Write `src/features/selector/data/auto/traces/<slug>.json`:

```json
{
  "image": "<the site plan's image url, exactly as prep printed it>",
  "widthPx": 1600, "heightPx": 1959,
  "pxPerM": 7.13, "northDeg": 329,
  "crop": [0, 0, 1095, 1000],
  "blocks": [
    { "block": "Blk 32", "core": [502, 307], "stacks": { "01": [544, 375], "02": [480, 375] } }
  ],
  "stackPositions": "labelled",
  "checked": "2026-10-05",
  "notes": "Scale bar 24 m = 171 px; north point 31° clockwise from plan up."
}
```

5. `python3 scripts/trace/trace_tools.py check <slug>` must print `OK`. Open
   `.trace/<slug>/check.jpg`: red dots on each block's core, blue dots on each
   stack's label, the red 50 m bar should match the plan's own scale bar, and
   the red N arrow should match the plan's north point. Fix and re-check.
6. `python3 scripts/huttons/build-sites.py --registry` to pick up new traces.

Never invent a position: a block or stack you can't find is left out, and the
site shows it arranged round its core with its facing marked as not confirmed.
