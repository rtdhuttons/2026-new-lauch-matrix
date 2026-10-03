// Thomson Reserve as a project bundle: the first complete project and the
// worked example for every future one. Geometry, units and view rules are
// built in ./index.ts; this file adds the facts, words, evidence and
// sources the website shows, and records what is still missing.

import type { ProjectBundle, SourceRecord } from "../../model/project";
import type { Provenance } from "../../model/types";
import { jadescape } from "../comparables/jadescape";
import { jadescapeRentals } from "../comparables/jadescape-rentals";
import { gallery, heroImage, locationMap } from "./gallery";
import { thomsonReserveDataset, thomsonReserveGaps, thomsonReserveMrtExit } from "./index";

const FACTSHEET: Provenance = {
  source: "Developer factsheet V1, 22 Sep 2026 (approved for release; bank details withheld)",
  updated: "2026-09-22",
  status: "verified",
};

const PIVOT_EBOOK: Provenance = {
  source: "TRM 'PIVOT' Matrix e-book for Thomson Reserve (Rex Tan, Huttons), as at 2 Jul 2026",
  updated: "2026-07-02",
  status: "estimated",
  note: "TRM's own assessment and worked examples.",
};

const LOCATION_MAP: Provenance = {
  source: "Developer's location map (marketing material)",
  updated: "2026-09-30",
  status: "verified",
  note: "Places named on the map; distances not measured.",
};

const schoolProvenance: Provenance = {
  source: "Developer's location map; school levels as generally known",
  updated: "2026-09-30",
  status: "estimated",
  note: "Named on the developer's map. Distances, MOE distance categories and P1 registration results have not been checked yet.",
};

const school = (name: string, levels: ("primary" | "secondary" | "junior-college")[]) => ({
  name,
  levels,
  distance: null,
  distanceCategory: null,
  p1History: [],
  provenance: schoolProvenance,
});

const sources: SourceRecord[] = [
  { item: "Project facts: developer, tenure, district, 1,268 homes, site area, expected vacant possession and legal completion", kind: "developer", source: "Developer factsheet V1", checked: "2026-09-22", status: "verified" },
  { item: "Unit type of every stack and level", kind: "developer", source: "Developer's elevation charts", checked: "2026-09-30", status: "verified" },
  { item: "Floor plans, unit areas and bedroom types", kind: "developer", source: "Developer's unit plans and factsheet", checked: "2026-09-18", status: "verified" },
  { item: "Block and stack positions, facings and distances", kind: "calculated", source: "Traced by TRM from the developer's site plan (scale bar and north point)", checked: "2026-09-30", status: "estimated" },
  { item: "Floor heights above Upper Thomson Road", kind: "developer", source: "Architect's brief (first homes) and factsheet (level 1 to 2); other floors assumed 3.15 m", checked: "2026-09-30", status: "estimated" },
  { item: "Gates and the 65 m covered link to Upper Thomson MRT", kind: "developer", source: "Architect's brief (circulation plan)", checked: "2026-09-30", status: "verified" },
  { item: "View clearance: south-west facings from level 5, north-east facings from level 21", kind: "agent", source: "TRM on-site assessment", checked: "2026-09-30", status: "estimated", note: "Surveyed heights would confirm it stack by stack." },
  { item: "Surrounding landed estates and their storeys", kind: "developer", source: "Architect's brief (surrounding landed housing map)", checked: "2026-09-30", status: "estimated" },
  { item: "Neighbourhood buildings, roads, parks and storeys", kind: "third-party", source: "OpenStreetMap contributors (ODbL)", checked: "2026-10-01", status: "estimated" },
  { item: "Sun positions and afternoon sun", kind: "calculated", source: "NOAA solar formulas on the traced facings", checked: "2026-09-30", status: "estimated" },
  { item: "Illustrative prices: $2,850 psf at the lowest level plus $15 psf a floor", kind: "illustrative", source: "TRM assumption until the developer's price list is released", checked: "2026-09-30", status: "assumed" },
  { item: "Renders and location map", kind: "developer", source: "Developer's marketing material (artist's impressions)", checked: "2026-09-30", status: "verified" },
  { item: "JadeScape resales and profit by floor band", kind: "third-party", source: "Huttons JadeScape report (URA Realis, EdgeProp, EcoProp, Huttons)", checked: "2026-09-22", status: "verified", note: "Bedroom counts inferred from size." },
  { item: "JadeScape rental contracts", kind: "third-party", source: "Huttons JadeScape rental report (URA Realis, EdgeProp, EcoProp, Huttons)", checked: "2026-10-03", status: "verified" },
  { item: "Why JadeScape is a fair guide (developer, homes, storeys, MRT)", kind: "agent", source: "TRM comparison", checked: "2026-10-01", status: "estimated", note: "Awaiting confirmation of the JadeScape facts." },
  { item: "PIVOT scores, entry-price and exit-benchmark worked examples", kind: "agent", source: "TRM 'PIVOT' Matrix e-book, 2 Jul 2026", checked: "2026-07-02", status: "estimated", note: "Overall stated as 8.6/10; the five scores average 8.8. Method to confirm." },
  { item: "Land bid: $810,000,000, $1,178 psf ppr", kind: "agent", source: "TRM 'PIVOT' Matrix e-book (page 14)", checked: "2026-07-02", status: "estimated", note: "Official URA tender record to be attached. $810M over the factsheet's buildable area (51,567 sq m × plot ratio 2.1) is about $695 psf ppr; the basis of $1,178 is to be confirmed." },
  { item: "Schools named near the site", kind: "developer", source: "Developer's location map", checked: "2026-09-30", status: "estimated", note: "Distances and P1 history not checked yet." },
];

export const thomsonReserve: ProjectBundle = {
  id: "thomson-reserve",
  status: "live",
  profile: {
    name: "Thomson Reserve",
    address: "1–11 Bright Hill Drive, Singapore 579580–579608",
    developer: "Tamarind Development Pte. Ltd. (CapitaLand Development, UOL Group and Singapore Land Group)",
    tenure: "99 years from 14 July 2026",
    district: "District 20",
    towersSummary: "2 towers of 30 storeys and 4 of 21",
    nearestMrt: "Upper Thomson MRT",
    expectedCompletion: {
      date: "2031-02-28",
      provenance: { ...FACTSHEET, note: "Expected date of Notice of Vacant Possession. Expected legal completion: 28 Feb 2034." },
    },
    provenance: FACTSHEET,
  },
  copy: {
    eyebrow: "Bright Hill Drive · Upper Thomson",
    tagline:
      "A sanctuary between the reservoirs and the city. Find your stack and floor, see how the view and the sun change as you rise, and what each level could cost.",
    heroFacts: [
      { label: "Units", value: "1,268" },
      { label: "Towers", value: "6, of 21 and 30 storeys" },
      { label: "Upper Thomson MRT", value: "65 m covered link" },
    ],
    cardSummary:
      "1,268 homes in six towers beside Upper Thomson MRT. Explore every stack and floor in 3D, with floor plans, sun, views and illustrative prices from level 1 to 30.",
    galleryTitle: "Life at Thomson Reserve",
    galleryLede: "Three clubs, a chain of pools shaped like the reservoirs next door, and towers set to face the green.",
    locationTitle: "Where city meets reserve",
    locationLede:
      "On Upper Thomson Road, with the MRT at the gate, the Central Catchment forest to the west and Bishan's schools and malls to the east.",
    disclaimer:
      "This selector is a TRM prototype. Thomson Reserve's layout is traced from the developer's site plan, with unit types and floor plans from the developer's unit plans; prices and availability are not published yet: any prices shown are illustrative estimates from the assumptions on the page, and nothing here is the developer's advice. Always check the developer's brochure, price list and sale and purchase agreement.",
  },
  dataset: thomsonReserveDataset,
  mrtEntrance: thomsonReserveMrtExit,
  media: { hero: heroImage, gallery },
  location: {
    map: locationMap,
    mapCaption: "Location map from the developer's marketing material. Not to scale. Tap to enlarge.",
    groups: [
      {
        title: "Getting around",
        items: [
          "Upper Thomson MRT (Thomson–East Coast Line) beside the site: a 65 m covered linkway from Side Gate 1",
          "Bright Hill, one stop north: a future interchange",
          "North–South Corridor (under construction), Central and Pan-Island Expressways",
        ],
      },
      {
        title: "Nature on the doorstep",
        items: [
          "Central Catchment Nature Reserve and MacRitchie Reservoir",
          "Windsor Nature Park and the MacRitchie Nature Trail",
          "Lower and Upper Peirce Reservoirs, the TreeTop Walk",
          "Singapore Island Country Club",
        ],
      },
      {
        title: "Food and shopping",
        items: [
          "Thomson Plaza and Midview City",
          "Junction 8, AMK Hub and Jubilee Square",
          "Shunfu, Mayflower, Kebun Baru and Sembawang Hills food centres",
        ],
      },
    ],
    provenance: LOCATION_MAP,
  },
  pricing: {
    estimate: { basePsf: 2850, stepPsf: 15 },
    estimateProvenance: {
      source: "TRM illustrative assumption",
      updated: "2026-09-30",
      status: "assumed",
      note: "$2,850 psf at the lowest level plus $15 psf for each floor above, until the developer's price list is released.",
    },
    priceList: null,
  },
  payments: { schedule: null, scheduleProvenance: null, maintenance: null },
  schools: {
    measuredFrom: "1–11 Bright Hill Drive",
    registrationYear: null,
    schools: [
      {
        ...school("Ai Tong School", ["primary"]),
        note: "TRM's PIVOT e-book: within 1 km, about an 11-minute walk. Not yet checked with the official OneMap distance.",
      },
      {
        ...school("CHIJ St. Nicholas Girls' School", ["primary", "secondary"]),
        note: "TRM's PIVOT e-book: about a 6-minute drive.",
      },
      school("Catholic High School", ["primary", "secondary"]),
      school("Peirce Secondary School", ["secondary"]),
      school("Mayflower Secondary School", ["secondary"]),
      school("Whitley Secondary School", ["secondary"]),
      school("Raffles Institution", ["secondary", "junior-college"]),
      school("Raffles Girls' School (Secondary)", ["secondary"]),
      school("Eunoia Junior College", ["junior-college"]),
    ],
    provenance: schoolProvenance,
  },
  comparables: [
    {
      project: jadescape,
      relevance: [
        { trait: "Big developer, large scale", comparable: "Qingjian Realty · 1,206 homes", subject: "UOL · Singapore Land · CapitaLand · 1,268 homes" },
        { trait: "High-rise towers", comparable: "Up to 23 storeys", subject: "6 towers, up to 30 storeys" },
        { trait: "Next to landed homes", comparable: "Shunfu and Thomson landed estates", subject: "Windsor Park Good Class Bungalows and landed estates" },
        { trait: "MRT at the doorstep", comparable: "Marymount MRT (Circle Line)", subject: "Upper Thomson MRT (Thomson–East Coast Line), 65 m covered link" },
        { trait: "Same corridor", comparable: "District 20, Thomson–Bishan", subject: "District 20, Thomson–Bishan" },
      ],
      image: {
        src: gallery.find((g) => g.src.endsWith("/lawn.jpg"))?.src ?? gallery[0].src,
        alt: "Thomson Reserve's lawn and clubhouse with towers behind. Artist's impression.",
        caption: "Thomson Reserve, Bright Hill Drive: big developers, high-rise beside landed homes, MRT at the gate. Artist's impression.",
      },
    },
  ],
  rentals: [jadescapeRentals],
  alternatives: [],
  pivot: {
    scores: [
      { category: "product-mix", score: 9, reason: "1,268 homes give a large variety of unit types in the mix, creating opportunities for both homeowners and investors." },
      { category: "investment-entry", score: 8, reason: "The estimated launch price is moderately competitive with the RCR market right now and will be a value buy." },
      { category: "value-add", score: 10, reason: "Within 1 km of Ai Tong School, Upper Thomson MRT at the doorstep, close to Thomson Plaza and numerous nature parks." },
      { category: "opportunity-zone", score: 8, reason: "Ongoing transformation around it: the Bright Hill MRT interchange with the upcoming Cross Island Line, and Bishan 2.0." },
      { category: "timing-of-exit", score: 9, reason: "Surrounded by landed properties, which may attract nearby retirees in future once their children move out of the landed home." },
    ],
    overallStated: 8.6,
    overallMethod: null,
    entry: {
      landPrice: 810_000_000,
      landPsfPpr: 1178,
      constructionPsf: 700,
      profitMargin: 0.15,
      breakevenUplift: 0.15,
      statedPsf: 2484,
      provenance: { ...PIVOT_EBOOK, note: "Page 15: ($1,178 + $700) × 1.15 × 1.15. Land bid $810,000,000 (page 14)." },
    },
    exit: {
      comparable: "Thomson Three",
      comparablePsf: 2200,
      comparableCompletionYear: 2016,
      subjectCompletionYear: 2031,
      growthPsfPerYear: 50,
      harmonisationUplift: 0.05,
      statedPsf: 3098,
      provenance: { ...PIVOT_EBOOK, note: "Page 26: ($2,200 + $50 × 15 years) × 1.05 for pre-harmonisation sizes. Thomson Three's $2,200 psf is an assumed average." },
    },
    provenance: PIVOT_EBOOK,
  },
  sources,
  gaps: [
    ...thomsonReserveGaps,
    "Developer's payment schedule, and maintenance fee estimates.",
    "Rental evidence for Thomson Reserve itself (none until it completes); JadeScape rents are used as the guide.",
    "School distances from the address, MOE distance categories and past P1 registration results.",
    "Alternative projects to compare, with dated prices.",
    "How the PIVOT overall rating is worked out (the e-book states 8.6/10; the five scores average 8.8).",
    "Official record of the land tender (URA) to back the $810M land bid, and the basis of $1,178 psf ppr (the factsheet's site area and plot ratio give about $695).",
    "Confirmation of the JadeScape facts in the fair-guide table.",
  ],
};
