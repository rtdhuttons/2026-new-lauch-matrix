import type { SourceRecord } from "../model/project";
import { SOURCE_KIND_LABEL } from "../model/project";
import { card } from "./ui";

const RULES: { title: string; body: string[] }[] = [
  {
    title: "Recommendation rules",
    body: [
      "Essentials come first: a unit must be on sale, within budget, match the bedroom count and, if you ask, have an estimated clear main view.",
      "Lifestyle fit is a weighted average of the criterion scores you weighted, using only criteria that have data. The share of your weights that had data is always shown. Missing values are never replaced with an average.",
      "Best fit for your lifestyle is the highest fit within your extra-spend limit, with at least 70% of your weights covered.",
      "Lowest entry price is the cheapest unit that meets your essentials.",
      "Best supported value is the unit that adds the most fit points per $10,000 over the lowest entry price. It must add at least 5 points, have at least 80% coverage and a view category that is not uncertain at its floor. Otherwise the lowest entry unit is the value pick.",
      "Appreciation potential is never ranked: there are no verified repeat-sale transactions, so the app says “insufficient evidence”.",
    ],
  },
  {
    title: "Criterion scores (0–100)",
    body: [
      "Afternoon sun: 100 minus the share of 4 hours of average afternoon sun, weighting the living room 60% and the master bedroom 40%.",
      "Views: below obstruction 10, partially cleared 45, estimated clear 85, clear with limited further gain 90. Uncertain floors use the conservative category.",
      "Quiet & privacy: 100 minus 22, 10 or 3 points for each higher, moderate or lower potential source or privacy issue in the screening.",
      "MRT: 100 at 5 minutes' walk or less, falling to 0 at 15 minutes.",
      "Exit appeal, out of 100: up to 50 points for less competition (fewer similar homes in the development), up to 30 points for the floor band's resale record at a comparable development (the weakest band 0, the strongest 30, in proportion to each band's annualised return), and 10 points for each distinctive feature, up to 20.",
    ],
  },
  {
    title: "View Clearance Floor Marker",
    body: [
      "Five sight lines are cast across the main view on the plan. For each one, the eye level needed to see the view target over every obstruction is solved from the obstruction's distance and top level, the target's distance and level, and the unit's floor level, all measured from the same height datum (sea level, or the adjoining road where only heights above it are known).",
      "Obstruction heights are ranges. The low end gives the optimistic floor and the high end the conservative floor; when they differ the marker shows a range.",
      "Estimated clear view: at least 4 of 5 sight lines clear. Partially cleared: at least one does. Limited further gain: all five clear and the floor is at least 3 above the clearance floor.",
      "Where an on-site assessment is recorded for a stack's facing, it sets the marker instead, labelled with its source. The geometric model stays in the cross-section for reference, and a block in the same development that blocks the view at every floor still decides the result.",
      "Future view risk is reported separately from current clearance.",
    ],
  },

];

/** The neighbourhood map rule; the project's own note says how its map was placed and how heights were set. */
const mapRule = (note: string | undefined): { title: string; body: string[] } => ({
  title: "The neighbourhood map",
  body: [
    "Roads, buildings, parks and water around the site come from OpenStreetMap (map data © OpenStreetMap contributors, ODbL), laid on the developer's site plan using the plan's north point and scale bar.",
    ...(note ? [note] : []),
    "Only neighbouring buildings with a recorded storey count are used in the view and noise checks; the others are drawn for context only.",
    "Turn off Surroundings to see the developer's full site plan without the map.",
  ],
});

const DATA_NEEDED: { area: string; items: string[] }[] = [
  {
    area: "Project and blocks",
    items: [
      "Developer site plan with block footprints, stack positions and north point",
      "Elevation drawings: ground (platform) levels in metres SHD, level 1 height, typical floor-to-floor height, roof height, sky terraces and other levels without homes",
      "Unit schedule by stack: layout code, strata area, facing of living room and master bedroom",
    ],
  },
  {
    area: "Prices and availability",
    items: [
      "Current price list with total prices for released units only",
      "Live availability (available, reserved, sold, not released) with the date updated",
    ],
  },
  {
    area: "Surroundings and views",
    items: [
      "Footprints and heights of neighbouring buildings (survey, URA 3D model or storey counts with roof heights), with sources",
      "Tree canopy heights where trees block views, ideally surveyed",
      "View targets: water levels, ridge or canopy levels and distances",
      "Master Plan zoning and approved developments for nearby land, to assess future view risk",
    ],
  },
  {
    area: "Sun exposure",
    items: [
      "Balcony depths, ledge and fin sizes, and window heights per layout",
      "Ideally a verified solar or daylight simulation to replace the illustrative geometric estimate",
    ],
  },
  {
    area: "Noise, privacy and access",
    items: [
      "Positions of pools, playgrounds, courts, arrival court, car park ramps and common walkways",
      "Road and expressway alignments; any measured or modelled noise data if available",
      "Gate positions and opening hours; walked routes to MRT entrances with distances and covered sections",
    ],
  },
  {
    area: "Resale and market",
    items: [
      "Nearby comparable projects with unit counts by bedroom type and size",
      "Verified transaction records (URA caveats or equivalent) with unit numbers, dates and prices, for like-for-like and repeat-sale analysis",
    ],
  },
];

export function MethodNotes({ gaps = [], sources = [], map }: { gaps?: string[]; sources?: SourceRecord[]; map?: { note?: string } | null }) {
  const rules = map ? [...RULES, mapRule(map.note)] : RULES;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
      <div className={`${card} p-5 sm:p-6`}>
        <h3 className="font-display text-lg font-extrabold">How the recommendations and calculations work</h3>
        {rules.map((r) => (
          <section key={r.title} className="mt-5">
            <h4 className="font-display-normal text-base font-semibold">{r.title}</h4>
            <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-[1rem] text-canopy/85">
              {r.body.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className={`${card} p-5 sm:p-6`}>
        <h3 className="font-display text-lg font-extrabold">Project data still needed</h3>
        {gaps.length > 0 && (
          <ul className="mt-3 grid list-disc gap-1.5 rounded-lg bg-mist py-3 pl-8 pr-4 text-[1rem] text-canopy/85">
            {gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[1rem] text-canopy/80">
          Each dataset is loaded separately, so these can be swapped in one at a time. Every record carries a source, update date and status: verified, estimated, assumed or unknown.
        </p>
        {DATA_NEEDED.map((d) => (
          <section key={d.area} className="mt-5">
            <h4 className="font-display-normal text-base font-semibold">{d.area}</h4>
            <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-[1rem] text-canopy/85">
              {d.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {sources.length > 0 && (
        <div className={`${card} p-0 lg:col-span-2`}>
          <h3 className="px-5 pt-5 font-display text-lg font-extrabold sm:px-6">Where each fact comes from</h3>
          <p className="px-5 pt-1 text-sm text-canopy/75 sm:px-6">
            Developer information, official records, research and map data, TRM&apos;s own assessments, calculated estimates and illustrative assumptions are kept apart.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse font-display-normal text-sm">
              <thead>
                <tr className="border-y border-canopy/10 bg-mist text-left text-xs uppercase tracking-[0.06em] text-canopy/70">
                  <th scope="col" className="px-5 py-2.5 font-semibold sm:px-6">Information</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Kind</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Source</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Checked</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((r) => (
                  <tr key={r.item} className="border-b border-canopy/10 align-top">
                    <td className="px-5 py-2.5 sm:px-6">
                      {r.item}
                      {r.note && <span className="block text-xs text-stone">{r.note}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{SOURCE_KIND_LABEL[r.kind]}</td>
                    <td className="px-3 py-2.5 text-canopy/80">{r.source}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{r.checked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
