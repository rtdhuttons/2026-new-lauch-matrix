// The Serra Residences as a project bundle, built from the Huttons New
// Launch API pull (huttons-project.ts, huttons-units.ts, huttons-media.ts)
// and the developer's plans it carries. Geometry and units are in ./index.ts.

import type { ProjectBundle, School, SourceRecord } from "../../model/project";
import type { Provenance } from "../../model/types";
import { applyListing } from "../../lib/listing";
import { huttonsProject } from "./huttons-project";
import { huttonsSync } from "./huttons-units";
import { serraDataset, serraGaps, serraMrtEntrance } from "./index";

// The API names the tower's two sections as blocks, "(L4-L16)" and
// "(L18-28)"; on this site they are one tower ("7").
const listing = applyListing(serraDataset, { ...huttonsSync, units: huttonsSync.units.map((u) => ["7", ...u.slice(1)] as typeof u) });

const HUTTONS: Provenance = { source: "Huttons New Launch API", updated: huttonsSync.fetched, status: "verified" };
const DEVELOPER: Provenance = {
  source: "Developer's project information (via the Huttons New Launch API)",
  updated: huttonsProject.fetched,
  status: "verified",
};

const imageBase = process.env.NEXT_PUBLIC_SERRA_IMAGE_BASE ?? "/the-serra-residences/images";
const towerImage = {
  src: `${imageBase}/tower-1051.jpg`,
  alt: "The Serra Residences tower rising above its landscaped podium, pool and arrival drive, with Novena's buildings behind. Artist's impression.",
};

/** Straight-line distance between OneMap address points, 7 Bassein Road to the school. */
const onemap = (metres: number): School["distance"] => ({
  byAddress: [{ address: "7 Bassein Road (309837)", metres }],
  method: "on OneMap, as a straight line from 7 Bassein Road's address point to the school's address point",
  provenance: {
    source: "SLA OneMap address search, 5 Oct 2026",
    updated: "2026-10-05",
    status: "verified",
    note: "MOE's official home-school distance is measured from your address to the school boundary, so it can be a little shorter than these figures.",
  },
});
const category = (metres: number): School["distanceCategory"] => ({
  value: metres <= 1000 ? "within-1km" : metres <= 2000 ? "1-2km" : "outside-2km",
  basis: "onemap",
});
const SCHOOL_SOURCE: Provenance = {
  source: "SLA OneMap address search; schools named in the developer's information",
  updated: "2026-10-05",
  status: "verified",
  note: "Past P1 registration results have not been checked yet.",
};
const primary = (name: string, metres: number, extra: Partial<School> = {}): School => ({
  name,
  levels: ["primary"],
  distance: onemap(metres),
  distanceCategory: category(metres),
  p1History: [],
  provenance: SCHOOL_SOURCE,
  ...extra,
});

const sources: SourceRecord[] = [
  { item: "Project facts: developer, tenure, address, district, 133 homes, launch and expected completion", kind: "third-party", source: "Huttons New Launch API", checked: huttonsProject.fetched, status: "verified" },
  { item: "Availability of every unit (all 133); prices once released", kind: "third-party", source: "Huttons New Launch API", checked: huttonsSync.fetched, status: "verified", note: `All ${listing.matched} units match the elevation chart by stack, floor, type and area.` },
  { item: "Unit type of every stack and level, and unit sizes", kind: "developer", source: "Developer's elevation chart (via the Huttons New Launch API)", checked: "2026-10-05", status: "verified" },
  { item: "Floor plans, and the penthouses' five bedrooms", kind: "developer", source: "Developer's unit plans (via the Huttons New Launch API)", checked: "2026-10-05", status: "verified" },
  { item: "Facilities by level and the site layout", kind: "developer", source: "Developer's site and facilities plans (via the Huttons New Launch API)", checked: "2026-10-05", status: "verified" },
  { item: "Unit positions and facings", kind: "calculated", source: "Traced by TRM from the developer's unit distribution plans (scale bar and north point)", checked: "2026-10-05", status: "estimated" },
  { item: "Floor heights (level 1 4.5 m, other floors 3.15 m)", kind: "illustrative", source: "TRM assumption; not published", checked: "2026-10-05", status: "assumed" },
  { item: "Walking distance to Novena MRT (741 m)", kind: "third-party", source: "Huttons New Launch API, nearby facilities", checked: "2026-10-05", status: "estimated", note: "The developer's material says about 8 minutes' walk." },
  { item: "Primary school distances", kind: "official", source: "SLA OneMap address search", checked: "2026-10-05", status: "verified", note: "Address point to address point." },
  { item: "Sun positions and afternoon sun", kind: "calculated", source: "NOAA solar formulas on the traced facings", checked: "2026-10-05", status: "estimated" },
  { item: "Indicative starting prices by unit type, from $3,120 psf", kind: "third-party", source: "Huttons launch flyer for The Serra Residences, information as at 2 Oct 2026", checked: "2026-10-05", status: "estimated", note: "Published while seeking indication of interest; subject to change without notice. Not the developer's price list." },
  { item: "Illustrative prices: $3,120 psf at level 4 plus $30 psf a floor", kind: "calculated", source: "TRM estimate fitted to the indicative starting prices (Huttons flyer, 2 Oct 2026)", checked: "2026-10-05", status: "estimated", note: "Each unit type's estimate at its lowest floor is within about 3% of its published starting price." },
  { item: "Land: bought for S$122 million in 2010 (former Pastoral View and 11 Bassein Road), about S$847 psf ppr", kind: "third-party", source: "The Listing Colony, 6 Aug 2026", checked: "2026-10-05", status: "estimated", note: "Not checked against an official record." },
  { item: "Render", kind: "developer", source: "Developer's marketing image (Huttons New Launch API project image); artist's impression", checked: "2026-10-05", status: "verified" },
];

export const serraResidences: ProjectBundle = {
  id: "the-serra-residences",
  status: "live",
  profile: {
    name: "The Serra Residences",
    address: "7 Bassein Road, Singapore 309837",
    developer: huttonsProject.developer,
    tenure: huttonsProject.tenure,
    district: "District 11 (Newton / Novena)",
    towersSummary: "1 tower of 28 storeys",
    nearestMrt: "Novena MRT",
    expectedCompletion: huttonsProject.completionDate
      ? { date: huttonsProject.completionDate, provenance: { ...HUTTONS, status: "estimated", note: "Expected TOP: Q4 2030 (Huttons New Launch API)." } }
      : null,
    launchDate: huttonsSync.launchDate ? { date: huttonsSync.launchDate, provenance: HUTTONS } : null,
    provenance: DEVELOPER,
  },
  copy: {
    eyebrow: "Bassein Road · Novena",
    tagline:
      "A freehold tower of 133 homes, a short walk from Novena MRT. Find your stack and floor, see where the homes get larger above the Sky Terrace, and what each level could cost.",
    heroFacts: [
      { label: "Units", value: "133" },
      { label: "Tenure", value: "Freehold" },
      { label: "Novena MRT", value: "About 8 min walk" },
    ],
    cardSummary:
      "133 freehold homes in one 28-storey tower near Novena MRT. Every stack and floor in 3D, with floor plans, sun and illustrative prices from level 4 to the penthouses.",
    galleryTitle: "The Serra Residences",
    galleryLede: "A slim tower above a podium of pools, a tennis court and gardens, with a Sky Terrace on level 17.",
    locationTitle: "Novena, close to everything",
    locationLede: "Off Thomson Road in District 11: Novena MRT and its malls on foot, Orchard Road a short drive, and SJI Junior within 1 km.",
    disclaimer:
      "This guide is a TRM prototype. The Serra Residences' layout is traced from the developer's plans, with unit types, floor plans and availability from the Huttons New Launch API; prices are not published yet: any prices shown are illustrative estimates from the assumptions on the page, and nothing here is the developer's advice. Always check the developer's brochure, price list and sale and purchase agreement.",
  },
  dataset: listing.dataset,
  mrtEntrance: serraMrtEntrance,
  media: {
    hero: { src: towerImage.src, srcSet: `${imageBase}/tower-630.jpg 630w, ${towerImage.src} 1051w`, alt: towerImage.alt },
    gallery: [
      {
        src: towerImage.src,
        alt: towerImage.alt,
        title: "One tower, 133 homes",
        caption: "Twenty-eight storeys above a podium of pools, a tennis court and gardens.",
      },
    ],
  },
  location: {
    map: null,
    mapCaption: "",
    groups: [
      {
        title: "Getting around",
        items: [
          "Novena MRT (North–South Line): about 8 minutes' walk",
          "Mount Pleasant MRT (Thomson–East Coast Line): about 6 minutes' drive",
          "Toa Payoh MRT: about 9 minutes' drive",
        ],
      },
      {
        title: "Food and shopping",
        items: [
          "2 Moulmein Road (redevelopment), Shaw Plaza, Square 2 and Zhongshan Mall: 8–9 minutes' walk",
          "Novena Square and Velocity, United Square: 10–15 minutes' walk",
          "Whampoa Drive Market Place and Pek Kio Market & Food Centre",
          "Newton Food Centre and Orchard Road: 5–8 minutes' drive",
        ],
      },
      {
        title: "Parks and leisure",
        items: [
          "Novena Park, Zhongshan Park and Novena Rise Park: 8–10 minutes' walk",
          "Whampoa Park and the Whampoa Park Connector",
          "Singapore Chinese Recreation Club and the Singapore Polo Club",
        ],
      },
      {
        title: "Work",
        items: ["Royal Square at Novena and Health City Novena: 6–8 minutes' walk", "Goldhill Plaza and United Square: about 4 minutes' drive"],
      },
    ],
    provenance: { ...DEVELOPER, note: "Walking and driving times as the developer gives them; not measured." },
  },
  pricing: {
    estimate: { basePsf: 3120, stepPsf: 30 },
    estimateProvenance: {
      source: "TRM estimate from the indicative starting prices (Huttons flyer, 2 Oct 2026)",
      updated: "2026-10-05",
      status: "estimated",
      note: "$3,120 psf at level 4 (the published \"from $3,120 psf\") plus $30 psf for each floor above, fitted so each unit type's lowest-floor estimate is within about 3% of its published starting price. Not the developer's price list.",
    },
    priceList: listing.priced > 0 ? { date: huttonsSync.fetched, provenance: { ...HUTTONS, note: `${listing.priced} units priced` } } : null,
    startingPrices: {
      headline: "From $3,120 psf",
      groups: [
        {
          name: "The Serra Residences (levels 4–16)",
          rows: [
            { type: "2-Bedroom + Study, 3-Bedroom Compact", sizeSqft: { min: 710, max: 764 }, from: 2_220_000 },
            { type: "3-Bedroom", sizeSqft: { min: 893, max: 904 }, from: 2_830_000 },
            { type: "4-Bedroom", sizeSqft: { min: 958, max: 958 }, from: 3_080_000 },
          ],
        },
        {
          name: "The Summit Collection (levels 18–28)",
          rows: [
            { type: "4-Bedroom", sizeSqft: { min: 1216, max: 1216 }, from: 4_310_000 },
            { type: "4-Bedroom + Study", sizeSqft: { min: 1335, max: 1335 }, from: 4_660_000 },
            { type: "4-Bedroom Premium with private lift", sizeSqft: { min: 1528, max: 1528 }, from: 5_440_000 },
            { type: "5-Bedroom Premium with private lift", sizeSqft: { min: 1755, max: 1755 }, from: 6_250_000 },
            { type: "Penthouse", sizeSqft: { min: 2648, max: 2669 }, from: null, note: "Price on application" },
          ],
        },
      ],
      provenance: {
        source: "Huttons launch flyer",
        updated: "2026-10-02",
        status: "estimated",
        note: "Indicative prices while seeking indication of interest; subject to change without notice. The developer's price list, once released, replaces them.",
      },
    },
  },
  payments: { schedule: null, scheduleProvenance: null, maintenance: null },
  schools: {
    measuredFrom: "7 Bassein Road",
    registrationYear: null,
    schools: [
      primary("St. Joseph's Institution Junior", 640, { highlighted: true, note: "The developer's information also says within 1 km." }),
      primary("Hong Wen School", 1100, {
        note: "Just over 1 km between address points. The developer's information says within 1 km, and MOE measures to the school boundary, which is nearer: check MOE's school finder for your unit.",
      }),
      primary("Farrer Park Primary School", 1230),
      primary("CHIJ Primary (Toa Payoh)", 1270),
      primary("Anglo-Chinese School (Primary)", 1460),
      primary("Kheng Cheng School", 1590),
      primary("Anglo-Chinese School (Junior)", 1700),
      primary("Pei Chun Public School", 1810),
      primary("Bendemeer Primary School", 1960, { note: "Close to the 2 km line." }),
      primary("First Toa Payoh Primary School", 2100),
      primary("Marymount Convent School", 2110),
      primary("St. Andrew's School (Junior)", 2130),
      primary("St. Margaret's School (Primary)", 2140),
      primary("Singapore Chinese Girls' School (Primary)", 2200),
    ],
    provenance: SCHOOL_SOURCE,
  },
  comparables: [],
  rentals: [],
  alternatives: [],
  pivot: { scores: null, overallStated: null, overallMethod: null, entry: null, provenance: null },
  sources,
  gaps: [
    ...serraGaps,
    "Developer's payment schedule and maintenance fee estimates.",
    "Resale and rental evidence from a comparable completed project nearby, for the Investor tab.",
    "Alternative projects to compare, chosen by TRM.",
    "TRM's PIVOT assessment (scores and entry-price workings).",
    "More renders and the developer's location map (the API marks them internal-only, so they were not fetched).",
    "Past P1 registration results for the schools.",
  ],
};
