// The Serra Residences (7 Bassein Road, D11).
//
// One 28-storey tower. Levels 4–16 ("The Serra Residences") have seven homes
// a floor, stacks 01–07; level 17 is the Sky Terrace; levels 18–27 ("The
// Summit") have four larger homes a floor on stacks 01, 03, 05 and 07; level
// 28 has two penthouses on stacks 01 and 05. So stacks 01, 03, 05 and 07
// change unit type above level 16, and stacks 02, 04 and 06 stop at level 16.
//
// Unit types by stack and level, and their sizes, come from the developer's
// elevation chart; every unit's availability from the Huttons New Launch API
// (huttons-units.ts). Positions are traced from the developer's unit
// distribution plans (public/the-serra-residences/site/site-plan.jpg): the
// centre of each unit's coloured shape, converted with the plans' own scale
// bar (25 m = 161 px) and north point (plan "up" is about 12° east of true
// north). Pixel positions below are on the top panel of that image (the
// facilities plan), which the unit plans register onto exactly.
//
// Not published, so left unknown rather than guessed: floor-to-floor heights
// and ground levels (assumed below, and labelled so), the heights of the
// buildings around the site (so the View Clearance Floor Marker says "Not
// assessed"), and prices.

import type {
  Block,
  Dataset,
  ExposureSource,
  ExternalRoute,
  Gate,
  InternalRoute,
  Layout,
  Point,
  Provenance,
  Stack,
  Unit,
} from "../../model/types";
import { distance, normaliseBearing } from "../../lib/geometry";

const UPDATED = "2026-10-05";
const PX_PER_M = 161 / 25;
const PLAN_NORTH_DEG = 12;
/** The site plan image is the facilities plan cropped at (60, 120), 840 × 530 px. */
const CROP = { x: 60, y: 120, widthPx: 840, heightPx: 530 };

/** Pixel position on the developer's plan (top panel) → plan metres on the cropped image. */
const P = (x: number, y: number): Point => ({ x: (x - CROP.x) / PX_PER_M, y: (y - CROP.y) / PX_PER_M });
const M = (px: number) => px / PX_PER_M;

const traced = (note: string): Provenance => ({
  source: "Traced from the developer's unit distribution plans",
  updated: UPDATED,
  status: "estimated",
  note,
});
const elevation = (note: string): Provenance => ({
  source: "Developer's elevation chart (via the Huttons New Launch API)",
  updated: UPDATED,
  status: "verified",
  note,
});
const unknown = (note: string): Provenance => ({ source: "Not published yet", updated: UPDATED, status: "unknown", note });

// Unit types from the elevation chart. Penthouse bedrooms from the unit plans.
interface TypeSeed {
  category: string;
  bedrooms: number;
  areaSqft: number;
  features: Layout["features"];
}
const TYPES: Record<string, TypeSeed> = {
  B1: { category: "2-Bedroom + Study", bedrooms: 2, areaSqft: 710, features: ["study"] },
  B1a: { category: "2-Bedroom + Study", bedrooms: 2, areaSqft: 710, features: ["study"] },
  B2: { category: "2-Bedroom + Study", bedrooms: 2, areaSqft: 721, features: ["study"] },
  C1: { category: "3-Bedroom", bedrooms: 3, areaSqft: 764, features: [] },
  C2: { category: "3-Bedroom", bedrooms: 3, areaSqft: 893, features: [] },
  C3: { category: "3-Bedroom", bedrooms: 3, areaSqft: 904, features: [] },
  D1: { category: "4-Bedroom", bedrooms: 4, areaSqft: 958, features: [] },
  D2: { category: "4-Bedroom", bedrooms: 4, areaSqft: 1216, features: [] },
  D3: { category: "4-Bedroom + Study", bedrooms: 4, areaSqft: 1335, features: ["study"] },
  D4: { category: "4-Bedroom Premium with private lift", bedrooms: 4, areaSqft: 1528, features: ["private lift lobby"] },
  E: { category: "5-Bedroom Premium with private lift", bedrooms: 5, areaSqft: 1755, features: ["private lift lobby"] },
  PH1: { category: "Penthouse", bedrooms: 5, areaSqft: 2648, features: ["private lift lobby", "study", "dual-aspect living"] },
  PH2: { category: "Penthouse", bedrooms: 5, areaSqft: 2669, features: ["private lift lobby", "dual-aspect living"] },
};

const layouts: Layout[] = Object.entries(TYPES).map(([code, t]) => ({
  id: code,
  name: `Type ${code}`,
  category: t.category,
  bedrooms: t.bedrooms,
  areaSqft: t.areaSqft,
  features: t.features,
  livingOverhangM: 1.8,
  masterOverhangM: 0.6,
  windowHeightM: 2.6,
  provenance: elevation(
    `${t.category}, ${t.areaSqft.toLocaleString("en-SG")} sq ft.${code.startsWith("PH") ? " Five bedrooms, from the developer's unit plan." : ""} Balcony depth for the sun estimate is assumed.`,
  ),
}));

/** A home's box on plan: centre (px), long and short sides (px), rotation (degrees clockwise). */
interface BoxSeed {
  at: [number, number];
  long: number;
  short: number;
  rot: number;
}
const box = (b: BoxSeed) => ({ position: P(...b.at), w: M(b.long), d: M(b.short), rotationDeg: b.rot });

// Lift core, and the centre and size of each unit's coloured shape on the plans.
const CORE: [number, number] = [685, 385];
interface StackSeed {
  id: string;
  /** Levels 4–16. */
  lower: { type: string; box: BoxSeed };
  /** Levels 18–27, The Summit. */
  summit?: { type: string; box: BoxSeed };
  /** Level 28. */
  penthouse?: { type: string; box: BoxSeed };
}
const STACKS: StackSeed[] = [
  {
    id: "01",
    lower: { type: "C1", box: { at: [710, 432], long: 62, short: 56, rot: 143 } },
    summit: { type: "D4", box: { at: [678, 462], long: 104, short: 67, rot: 126 } },
    penthouse: { type: "PH1", box: { at: [704, 434], long: 188, short: 65, rot: 131 } },
  },
  { id: "02", lower: { type: "C2", box: { at: [665, 477], long: 73, short: 60, rot: 112 } } },
  {
    id: "03",
    lower: { type: "B2", box: { at: [600, 429], long: 68, short: 56, rot: 150 } },
    summit: { type: "D3", box: { at: [612, 410], long: 112, short: 53, rot: 121 } },
  },
  { id: "04", lower: { type: "B1", box: { at: [623, 381], long: 61, short: 51, rot: 125 } } },
  {
    id: "05",
    lower: { type: "B1a", box: { at: [657, 334], long: 61, short: 51, rot: 125 } },
    summit: { type: "E", box: { at: [685, 309], long: 132, short: 60, rot: 129 } },
    penthouse: { type: "PH2", box: { at: [666, 330], long: 198, short: 60, rot: 130 } },
  },
  { id: "06", lower: { type: "C3", box: { at: [696, 289], long: 91, short: 55, rot: 113 } } },
  {
    id: "07",
    lower: { type: "D1", box: { at: [751, 372], long: 80, short: 56, rot: 123 } },
    summit: { type: "D2", box: { at: [747, 377], long: 93, short: 58, rot: 123 } },
  },
];

const LOWER = { from: 4, to: 16 };
const SUMMIT = { from: 18, to: 27 };
const PENTHOUSE = 28;
const SKY_TERRACE = 17;

// Floor heights are not published. Level 1 (car park) and the typical
// floor-to-floor height are assumed, so heights above ground are approximate.
const LEVEL1_HEIGHT_M = 4.5;
const TYPICAL_FLOOR_M = 3.15;

const corners = (b: ReturnType<typeof box>): Point[] => {
  const r = (b.rotationDeg * Math.PI) / 180;
  return [
    [-b.w / 2, -b.d / 2], [b.w / 2, -b.d / 2], [b.w / 2, b.d / 2], [-b.w / 2, b.d / 2],
  ].map(([x, y]) => ({ x: b.position.x + x * Math.cos(r) - y * Math.sin(r), y: b.position.y + x * Math.sin(r) + y * Math.cos(r) }));
};

function convexHull(points: Point[]): Point[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: Point[]) => {
    const out: Point[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    return out;
  };
  const lower = half(pts);
  const upper = half([...pts].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

const footprint = convexHull(STACKS.flatMap((s) => corners(box(s.lower.box))));
const xs = footprint.map((p) => p.x);
const ys = footprint.map((p) => p.y);
const core = P(...CORE);

const tower: Block = {
  id: "7",
  name: "Tower",
  centre: core,
  size: { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) },
  rotationDeg: 0,
  storeys: 28,
  groundRL: 0,
  level1HeightM: LEVEL1_HEIGHT_M,
  typicalFloorHeightM: TYPICAL_FLOOR_M,
  roofAllowanceM: 4,
  noUnitLevels: [SKY_TERRACE],
  firstResidentialLevel: LOWER.from,
  footprint,
  provenance: {
    source: "Developer's elevation chart; floor heights assumed",
    updated: UPDATED,
    status: "estimated",
    note: "28 storeys: basement and level 1 car parks, level 2 arrival, tennis court and car park, level 3 facilities, homes on levels 4–16, Sky Terrace on level 17, homes on levels 18–28. Floor heights are not published: level 1 is taken as 4.5 m and other floors as 3.15 m.",
  },
};

const planBearing = (from: Point, to: Point) => normaliseBearing((Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI);
const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
const compass = (b: number) => COMPASS[Math.round(normaliseBearing(b) / 45) % 8];

const describe = (code: string) => `Type ${code} (${TYPES[code].category}, ${TYPES[code].areaSqft.toLocaleString("en-SG")} sq ft)`;

const stacks: Stack[] = STACKS.map((seed) => {
  const position = P(...seed.lower.box.at);
  // Homes face outwards from the lift core.
  const living = normaliseBearing(planBearing(core, position) + PLAN_NORTH_DEG);
  const notes = [
    `Levels ${LOWER.from}–${LOWER.to}: ${describe(seed.lower.type)}.`,
    ...(seed.summit
      ? [`Levels ${SUMMIT.from}–${SUMMIT.to} (The Summit): ${describe(seed.summit.type)}, a larger home over this part of the tower.`]
      : [`No homes above level ${LOWER.to}: from level ${SUMMIT.from} the floor has four larger homes, on stacks 01, 03, 05 and 07.`]),
    ...(seed.penthouse ? [`Level ${PENTHOUSE}: penthouse ${describe(seed.penthouse.type)}, with a private car park lot (accessory lot) on level 2.`] : []),
    `Level ${SKY_TERRACE} is the Sky Terrace (social and retreat lounges, zen deck, wellness garden).`,
  ];
  return {
    id: seed.id,
    blockId: tower.id,
    layoutId: seed.lower.type,
    position,
    livingBearingDeg: living,
    masterBearingDeg: living,
    mainView: {
      label: `Outward, to the ${compass(living)}`,
      bearingDeg: living,
      coneHalfWidthDeg: 12,
      targetId: "",
      provenance: unknown("Direction traced from the plans; what each floor sees over its neighbours has not been assessed yet"),
    },
    footprint: { w: M(seed.lower.box.long), d: M(seed.lower.box.short), rotationDeg: seed.lower.box.rot },
    notes,
    provenance: traced("Position at the centre of the unit's shape on the plans; facing assumed to point away from the lift core"),
  };
});

const planBase = process.env.NEXT_PUBLIC_SERRA_PLAN_BASE ?? "/the-serra-residences/plans";
const floorPlan = (code: string) => ({
  src: `${planBase}/${code.toLowerCase()}.png`,
  mirrored: false,
  credit: "Developer's unit plans (via the Huttons New Launch API). Not drawn to scale.",
});

const units: Unit[] = STACKS.flatMap((seed) => {
  const rows: Unit[] = [];
  const add = (level: number, code: string, own?: BoxSeed) =>
    rows.push({
      id: `${seed.id}-${String(level).padStart(2, "0")}`,
      stackId: seed.id,
      level,
      status: "pending",
      price: null,
      typeCode: code,
      floorPlan: floorPlan(code),
      ...(own ? { layoutId: code, box: box(own) } : {}),
      priceProvenance: unknown("The developer's price list has not been released"),
    });
  for (let l = LOWER.from; l <= LOWER.to; l++) add(l, seed.lower.type);
  if (seed.summit) for (let l = SUMMIT.from; l <= SUMMIT.to; l++) add(l, seed.summit.type, seed.summit.box);
  if (seed.penthouse) add(PENTHOUSE, seed.penthouse.type, seed.penthouse.box);
  return rows;
});

// Roads and facilities drawn from the plan.
const BASSEIN = [P(40, 143), P(920, 143)];
const AKYAB = [P(876, 110), P(876, 680)];
const TAN_TOCK_SENG = [P(102, 150), P(102, 680)];
const plan = traced("Drawn from the developer's facilities plan; road centrelines approximate");

const exposureSources: ExposureSource[] = [
  { id: "bassein", kind: "main-road", name: "Bassein Road", geometry: BASSEIN, activity: "Local traffic to the homes and schools along it", provenance: plan },
  { id: "akyab", kind: "main-road", name: "Akyab Road", geometry: AKYAB, activity: "Local traffic", provenance: plan },
  { id: "tan-tock-seng", kind: "main-road", name: "Jalan Tan Tock Seng", geometry: TAN_TOCK_SENG, activity: "Local traffic", provenance: plan },
  { id: "lap-pool", kind: "pool", name: "60 m lap pool and spa pool (level 3)", geometry: [P(450, 339), P(571, 301)], activity: "Lap and leisure swimming; busier at weekends", provenance: plan },
  { id: "kids", kind: "playground", name: "Kids' pool, pavilion and playground (level 3)", geometry: [P(757, 432), P(712, 488)], activity: "Children's play, mostly afternoons and weekends", provenance: plan },
  { id: "tennis", kind: "tennis", name: "Tennis court (level 2)", geometry: [P(272, 275)], activity: "Evenings and weekends; likely floodlit", provenance: plan },
  { id: "arrival", kind: "arrival-court", name: "Arrival bay and guard house, Bassein Road", geometry: [P(407, 274), P(478, 237)], activity: "Drop-offs, taxis and deliveries", provenance: plan },
  { id: "carpark-drive", kind: "vehicle-ramp", name: "Driveway to the car park (level 2)", geometry: [P(509, 302)], activity: "Residents' cars, busiest at morning and evening peaks", provenance: plan },
  { id: "service", kind: "service-road", name: "Service driveway to the bin centre (basement)", geometry: [P(843, 438), P(766, 522)], activity: "Refuse collection and service vehicles, usually early morning", provenance: plan },
];

const gates: Gate[] = [
  { id: "main", name: "Main entrance and guard house, Bassein Road", position: P(455, 190), opening: "Vehicle and pedestrian entrance with guard house (developer's facilities plan)" },
  { id: "west", name: "Side gate, Jalan Tan Tock Seng", position: P(151, 351), opening: "Pedestrian side gate (developer's facilities plan: side gates at levels 1 and 2); hours not published" },
  { id: "east", name: "Side gate, Akyab Road", position: P(843, 358), opening: "Pedestrian side gates (developer's facilities plan: side gates at levels 1 and 2); hours not published" },
];

const internalRoutes: InternalRoute[] = gates.map((g) => ({
  blockId: tower.id,
  gateId: g.id,
  path: [core, g.position],
  // Straight line plus 25% for paths round the landscaping.
  distanceM: Math.round(distance(core, g.position) * 1.25),
  coveredM: null,
  provenance: {
    source: "TRM estimate from the site plan",
    updated: UPDATED,
    status: "estimated",
    note: "Straight line from the lift core to the gate plus 25%; not a walked route.",
  },
}));

// Novena MRT (NS20) is off the plan, to the south-west. Its position is
// placed from map coordinates (Huttons New Launch API), with the tower's
// OneMap address point (7 Bassein Road) at the lift core.
const PROJECT_LL = { lat: 1.3230483, lon: 103.84784 };
const NOVENA_LL = { lat: 1.32044, lon: 103.84383 };
function fromLatLon(ll: { lat: number; lon: number }): Point {
  const north = (ll.lat - PROJECT_LL.lat) * 110574;
  const east = (ll.lon - PROJECT_LL.lon) * 111320 * Math.cos((PROJECT_LL.lat * Math.PI) / 180);
  const r = (PLAN_NORTH_DEG * Math.PI) / 180;
  // Rotate true east/north into the plan, whose "up" is PLAN_NORTH_DEG east of north.
  return { x: core.x + east * Math.cos(r) - north * Math.sin(r), y: core.y - (east * Math.sin(r) + north * Math.cos(r)) };
}
const novena = fromLatLon(NOVENA_LL);

const externalRoutes: ExternalRoute[] = [
  {
    gateId: "west",
    destination: "Novena MRT (NS20)",
    path: [gates[1].position, novena],
    distanceM: 741,
    coveredM: null,
    crossings: "Not confirmed",
    provenance: {
      source: "Huttons New Launch API, nearby facilities (walking route from the project)",
      updated: UPDATED,
      status: "estimated",
      note: "741 m walking distance from the project to the station. The developer's material says about 8 minutes' walk. The exact route and gate are not stated, so it is placed at the Jalan Tan Tock Seng side gate, the one nearest the station.",
    },
  },
];

const planImageSrc = process.env.NEXT_PUBLIC_SERRA_SITE_PLAN ?? "/the-serra-residences/site-plan.jpg";

export const serraDataset: Dataset = {
  project: {
    name: "The Serra Residences",
    isDemo: false,
    demoNotice: "",
    tenure: "Freehold",
    totalUnits: units.length,
    siteBounds: { width: CROP.widthPx / PX_PER_M, height: CROP.heightPx / PX_PER_M },
    planNorthDeg: PLAN_NORTH_DEG,
    latitudeDeg: PROJECT_LL.lat,
    longitudeDeg: PROJECT_LL.lon,
    utcOffsetHours: 8,
    heightDatum: "ground level",
    provenance: elevation("133 homes in one tower of 28 storeys"),
    display: {
      planImage: {
        src: planImageSrc,
        widthM: CROP.widthPx / PX_PER_M,
        heightM: CROP.heightPx / PX_PER_M,
        credit: "Site plan: developer's marketing material",
      },
      notice:
        "Built from the developer's elevation chart, unit plans and site plans, with availability from the Huttons New Launch API. Prices are illustrative until the price list is released, and views over the neighbours have not been assessed yet.",
      pricingNote: "Awaiting the developer's price list. Prices appear once it is loaded.",
      // Matched to the developer's elevation chart.
      unitTypeColours: [
        { category: "2-Bedroom + Study", colour: "#b1af98" },
        { category: "3-Bedroom", colour: "#d09170" },
        { category: "4-Bedroom", colour: "#9298ab" },
        { category: "4-Bedroom + Study", colour: "#9c799f" },
        { category: "4-Bedroom Premium with private lift", colour: "#473454" },
        { category: "5-Bedroom Premium with private lift", colour: "#c7a962" },
        { category: "Penthouse", colour: "#ac6627" },
      ],
      unitTypeColoursCredit: "Colours match the developer's elevation chart (one shade per bedroom type).",
    },
  },
  blocks: [tower],
  layouts,
  stacks,
  units,
  obstructions: [],
  viewTargets: [],
  futureSites: [],
  exposureSources,
  gates,
  internalRoutes,
  externalRoutes,
  transactions: [],
  nearbyProjects: [],
};

export const serraMrtEntrance = novena;

/** Known gaps, kept next to the data so they are not forgotten. */
export const serraGaps = [
  "Prices: awaiting the developer's price list (preview from 1 Oct 2026, launch 17 Oct 2026 per the Huttons New Launch API).",
  "Views: the heights of the buildings around the site are not loaded, and TRM has not made an on-site view assessment, so the View Clearance Floor Marker says \"Not assessed\".",
  "Floor heights and ground level: not published; level 1 is taken as 4.5 m and other floors as 3.15 m.",
  "Room facings: living rooms are assumed to face away from the lift core until each unit plan is keyed in.",
  "Walked route to Novena MRT: the 741 m figure is the API's walking distance from the project; the route inside the site is estimated.",
];
