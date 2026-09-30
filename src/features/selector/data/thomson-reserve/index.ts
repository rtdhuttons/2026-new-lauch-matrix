// Thomson Reserve (1–11 Bright Hill Drive, D20).
//
// Layout traced from the developer's site plan image (public/thomson-reserve/
// site-plan.jpg): stack positions are the centres of the numbered stack
// labels, converted with the plan's own scale bar (266 px = 100 m) and north
// point (plan "up" is 40° east of true north).
//
// Unit types by stack and level come from the developer's elevation charts
// (unit-schedule.ts); sizes, collections, storeys and heights from the
// developer factsheet of 22 Sep 2026.
//
// Not yet known, and deliberately left unknown rather than guessed: prices
// and availability, exact finished floor levels, and the heights of
// neighbouring buildings (so view clearance is "not assessed" until they are
// loaded).

import type {
  Block,
  Dataset,
  ExposureSource,
  ExternalRoute,
  Gate,
  InternalRoute,
  Layout,
  Obstruction,
  Point,
  Provenance,
  Stack,
  Unit,
} from "../../model/types";
import { blockTopRL, distance, normaliseBearing, polylineLength } from "../../lib/geometry";
import { unitSchedule } from "./unit-schedule";

const UPDATED = "2026-09-30";
const PX_PER_M = 266 / 100;
const PLAN_NORTH_DEG = 40;
const IMAGE = { widthPx: 1520, heightPx: 696 };

/** Pixel position on the site plan image → plan metres. */
const P = (x: number, y: number): Point => ({ x: x / PX_PER_M, y: y / PX_PER_M });

const traced = (note: string): Provenance => ({
  source: "Traced from the developer's site plan",
  updated: UPDATED,
  status: "estimated",
  note,
});
const factsheet = (note: string): Provenance => ({
  source: "Developer factsheet, 22 Sep 2026",
  updated: "2026-09-22",
  status: "verified",
  note,
});

const unknown = (note: string): Provenance => ({
  source: "Not published yet",
  updated: UPDATED,
  status: "unknown",
  note,
});

interface BlockSeed {
  id: string;
  core: [number, number];
  collection: "Classic" | "Luxury";
  stacks: Record<string, [number, number]>;
}

// Pixel centres of each stack's number on the site plan, and the block core.
const blockSeeds: BlockSeed[] = [
  {
    id: "1",
    core: [1245, 390],
    collection: "Classic",
    stacks: {
      "01": [1279, 379], "02": [1270, 402], "03": [1261, 421], "04": [1250, 442], "05": [1235, 465],
      "06": [1210, 427], "07": [1224, 406], "08": [1235, 386], "09": [1247, 355],
    },
  },
  {
    id: "3",
    core: [1074, 487],
    collection: "Classic",
    stacks: {
      "10": [1132, 490], "11": [1111, 500], "12": [1086, 505], "13": [1065, 510], "14": [1040, 514],
      "15": [1030, 476], "16": [1055, 471], "17": [1080, 465], "18": [1102, 455],
    },
  },
  {
    id: "5",
    core: [510, 464],
    collection: "Luxury",
    stacks: {
      "19": [550, 496], "20": [515, 486], "21": [492, 482], "22": [465, 474], "23": [460, 428],
      "24": [486, 431], "25": [510, 441], "26": [529, 448], "27": [555, 455],
    },
  },
  {
    id: "7",
    core: [362, 365],
    collection: "Luxury",
    stacks: {
      "28": [335, 402], "29": [342, 377], "30": [342, 354], "31": [344, 332], "32": [345, 306],
      "33": [391, 327], "34": [389, 352], "35": [385, 372], "36": [390, 402],
    },
  },
  {
    id: "9",
    core: [955, 360],
    collection: "Classic",
    stacks: {
      "37": [912, 352], "38": [937, 345], "39": [960, 339], "40": [982, 331], "41": [992, 369],
      "42": [971, 380], "43": [952, 386], "44": [930, 392], "45": [896, 395],
    },
  },
  {
    id: "11",
    core: [1132, 230],
    collection: "Classic",
    stacks: {
      "46": [1076, 192], "47": [1098, 199], "48": [1127, 207], "49": [1149, 214], "50": [1172, 226],
      "51": [1162, 262], "52": [1135, 253], "53": [1112, 249], "54": [1091, 245], "55": [1068, 238],
    },
  },
];

// Classic blocks: level 1 is a car park, homes from level 2. Luxury blocks:
// car park in the basement, homes from level 1 in six stacks per block.
const COLLECTION = {
  Classic: { storeys: 21, firstResidentialLevel: 2, homeSizeM: 9.5 },
  Luxury: { storeys: 30, firstResidentialLevel: 1, homeSizeM: 11 },
} as const;

/** Level 1 to level 2 landscape decks differ by about 4.3 m (factsheet FAQ). */
const LEVEL1_HEIGHT_M = 4.3;
/** 2.85 m floor-to-ceiling (factsheet) plus an assumed 0.3 m slab and finishes. */
const TYPICAL_FLOOR_M = 3.15;

interface TypeFamily {
  match: RegExp;
  label: string;
  bedrooms: number;
  areaSqft: number;
  areaSqm: number;
  features: Layout["features"];
}

// Order matters: longer prefixes first. Sizes from the factsheet unit mix.
const FAMILIES: TypeFamily[] = [
  { match: /^BPS4/, label: "2-Bedroom Premium + Study", bedrooms: 2, areaSqft: 775, areaSqm: 72, features: ["study"] },
  { match: /^BPS/, label: "2-Bedroom Premium + Study", bedrooms: 2, areaSqft: 732, areaSqm: 68, features: ["study"] },
  { match: /^BP/, label: "2-Bedroom Premium", bedrooms: 2, areaSqft: 678, areaSqm: 63, features: [] },
  { match: /^B/, label: "2-Bedroom", bedrooms: 2, areaSqft: 592, areaSqm: 55, features: [] },
  { match: /^CPS/, label: "3-Bedroom Premium + Study", bedrooms: 3, areaSqft: 1152, areaSqm: 107, features: ["study"] },
  { match: /^CP/, label: "3-Bedroom Premium", bedrooms: 3, areaSqft: 1055, areaSqm: 98, features: [] },
  { match: /^C/, label: "3-Bedroom", bedrooms: 3, areaSqft: 947, areaSqm: 88, features: [] },
  { match: /^DPS/, label: "4-Bedroom Premium + Study", bedrooms: 4, areaSqft: 1485, areaSqm: 138, features: ["study", "private lift lobby"] },
  { match: /^DP/, label: "4-Bedroom Premium", bedrooms: 4, areaSqft: 1367, areaSqm: 127, features: ["private lift lobby"] },
  { match: /^D/, label: "4-Bedroom", bedrooms: 4, areaSqft: 1238, areaSqm: 115, features: [] },
  { match: /^E/, label: "5-Bedroom Suite", bedrooms: 5, areaSqft: 1808, areaSqm: 168, features: ["private lift lobby"] },
];

function familyOf(code: string): TypeFamily {
  const f = FAMILIES.find((x) => x.match.test(code));
  if (!f) throw new Error(`Unknown unit type ${code}`);
  return f;
}

const layoutId = (code: string) => code.replace(/\s+/g, "");

function layoutFor(code: string): Layout {
  const f = familyOf(code);
  return {
    id: layoutId(code),
    name: `Type ${code}`,
    category: f.label,
    bedrooms: f.bedrooms,
    areaSqft: f.areaSqft,
    features: f.features,
    livingOverhangM: 1.8,
    masterOverhangM: 0.6,
    windowHeightM: 2.6,
    provenance: factsheet(`${f.label}, ${f.areaSqm} sqm (${f.areaSqft.toLocaleString("en-SG")} sq ft). Balcony depth for the sun estimate is assumed.`),
  };
}

const STACK_NOTES: Record<string, string[]> = Object.fromEntries(
  ["19", "20", "21", "22"].map((id) => [
    id,
    ["Acoustic ceiling at the balcony, provided by the developer for this stack only (factsheet FAQ)."],
  ]),
);

/** Principal axis of a block's stacks, degrees clockwise on plan. */
function principalAxisDeg(points: Point[]): number {
  const cx = points.reduce((a, p) => a + p.x, 0) / points.length;
  const cy = points.reduce((a, p) => a + p.y, 0) / points.length;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.x - cx) ** 2;
    syy += (p.y - cy) ** 2;
    sxy += (p.x - cx) * (p.y - cy);
  }
  return (0.5 * Math.atan2(2 * sxy, sxx - syy) * 180) / Math.PI;
}

function convexHull(points: Point[]): Point[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function squareCorners(c: Point, size: number, rotDeg: number): Point[] {
  const r = (rotDeg * Math.PI) / 180;
  const h = size / 2;
  return [
    [-h, -h], [h, -h], [h, h], [-h, h],
  ].map(([x, y]) => ({
    x: c.x + x * Math.cos(r) - y * Math.sin(r),
    y: c.y + x * Math.sin(r) + y * Math.cos(r),
  }));
}

const planBearing = (from: Point, to: Point) =>
  normaliseBearing((Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI);

const layouts: Layout[] = [...new Set(Object.values(unitSchedule).map((s) => s.type))].map(layoutFor);

const blocks: Block[] = [];
const stacks: Stack[] = [];

for (const seed of blockSeeds) {
  const cfg = COLLECTION[seed.collection];
  const core = P(...seed.core);
  const positions = Object.values(seed.stacks).map(([x, y]) => P(x, y));
  const axis = principalAxisDeg(positions);
  const corners = positions.flatMap((p) => squareCorners(p, cfg.homeSizeM, axis));
  const hull = convexHull(corners);
  const xs = hull.map((p) => p.x);
  const ys = hull.map((p) => p.y);

  blocks.push({
    id: seed.id,
    name: `Block ${seed.id}`,
    centre: core,
    size: { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) },
    rotationDeg: 0,
    storeys: cfg.storeys,
    groundRL: 22,
    level1HeightM: LEVEL1_HEIGHT_M,
    typicalFloorHeightM: TYPICAL_FLOOR_M,
    roofAllowanceM: 4,
    noUnitLevels: [],
    firstResidentialLevel: cfg.firstResidentialLevel,
    collection: seed.collection,
    footprint: hull,
    provenance: factsheet(
      `${seed.collection} Collection, ${cfg.storeys} storeys. Level 1 to 2 about 4.3 m (factsheet FAQ); typical floor-to-floor 3.15 m assumed from the 2.85 m ceiling; ground level assumed.`,
    ),
  });

  for (const [id, [x, y]] of Object.entries(seed.stacks)) {
    const position = P(x, y);
    // Homes in a point block face outwards from the lift core.
    const living = normaliseBearing(planBearing(core, position) + PLAN_NORTH_DEG);
    stacks.push({
      id,
      blockId: seed.id,
      layoutId: layoutId(unitSchedule[id].type),
      position,
      livingBearingDeg: living,
      masterBearingDeg: living,
      mainView: {
        label: "Outward view",
        bearingDeg: living,
        coneHalfWidthDeg: 12,
        targetId: "",
        provenance: unknown("View targets and neighbouring building heights are not loaded yet"),
      },
      footprint: { w: cfg.homeSizeM, d: cfg.homeSizeM, rotationDeg: axis },
      notes: STACK_NOTES[id],
      provenance: traced("Stack position from its label on the site plan; facing assumed to point away from the lift core"),
    });
  }
}

const units: Unit[] = stacks.flatMap((s) => {
  const plan = unitSchedule[s.id];
  const levels = new Map<number, string>();
  for (let level = plan.from; level <= plan.to; level++) levels.set(level, plan.type);
  for (const [level, code] of Object.entries(plan.other)) levels.set(Number(level), code);
  return [...levels.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, code]) => ({
      id: `${s.id}-${String(level).padStart(2, "0")}`,
      stackId: s.id,
      level,
      status: "pending" as const,
      price: null,
      typeCode: code,
      priceProvenance: unknown("The developer's price list has not been released"),
    }));
});

const obstructions: Obstruction[] = blocks.map((b) => {
  const top = blockTopRL(b);
  return {
    id: `own-${b.id}`,
    name: `${b.name} (Thomson Reserve)`,
    kind: "own-block",
    footprint: b.footprint!,
    baseRL: b.groundRL,
    topRL: { min: top, max: top },
    heightProvenance: factsheet("Storeys from the factsheet; floor heights partly assumed"),
    blockId: b.id,
  };
});

const plan = traced("Drawn from the site plan; road centrelines are approximate");

const exposureSources: ExposureSource[] = [
  {
    id: "upper-thomson",
    kind: "main-road",
    name: "Upper Thomson Road",
    geometry: [P(-40, 160), P(40, 330), P(200, 520), P(450, 632), P(800, 668), P(1200, 662), P(1480, 640)],
    activity: "Heavy traffic and buses through the day; busiest at morning and evening peaks",
    provenance: plan,
  },
  {
    id: "sin-ming",
    kind: "main-road",
    name: "Sin Ming Avenue",
    geometry: [P(-40, 110), P(80, 40), P(200, -20)],
    activity: "Local traffic and buses; peaks at school and work hours",
    provenance: plan,
  },
  {
    id: "bright-hill",
    kind: "main-road",
    name: "Bright Hill Drive",
    geometry: [P(1250, 40), P(1330, 190), P(1420, 350), P(1490, 500)],
    activity: "Local traffic; school drop-offs in the morning",
    provenance: plan,
  },
  { id: "pool-west", kind: "pool", name: "Grand Clubhouse pools (west)", geometry: [P(560, 390)], activity: "Leisure and lap pools; busier at weekends and in school holidays", provenance: plan },
  { id: "pool-central", kind: "pool", name: "Grand Clubhouse pools and Grand Lawn", geometry: [P(760, 420)], activity: "Leisure and lap pools, lawn events; busier at weekends", provenance: plan },
  { id: "pool-east", kind: "pool", name: "Island Club pools", geometry: [P(1010, 440)], activity: "Island Pool and 50 m lap pool; busier at weekends and in school holidays", provenance: plan },
  { id: "wellness", kind: "pool", name: "Wellness Club hydro pools", geometry: [P(250, 330)], activity: "Spa and hydrotherapy pools; quieter use", provenance: plan },
  { id: "courts", kind: "tennis", name: "Tennis and multi-purpose courts (Wellness Club)", geometry: [P(150, 170)], activity: "Evenings and weekends; likely floodlit", provenance: plan },
  { id: "drop-off", kind: "arrival-court", name: "Drop-off, Bright Hill Drive", geometry: [P(1175, 300)], activity: "School and work drop-offs, deliveries, taxis", provenance: plan },
];

const gates: Gate[] = [
  { id: "bright-hill", name: "Guardhouse, Bright Hill Drive", position: P(1272, 240), opening: "Main entrance with guardhouse (factsheet)" },
  { id: "sin-ming", name: "Guardpost, Sin Ming Avenue", position: P(152, 72), opening: "Second entrance with guardpost (factsheet)" },
  { id: "side", name: "Pedestrian side gate by MRT Exit 2", position: P(1340, 478), opening: "Proximity card access (factsheet); hours not published" },
];

const mrtExit = P(1368, 470);

const internalRoutes: InternalRoute[] = blocks.flatMap((b) =>
  gates.map((g) => ({
    blockId: b.id,
    gateId: g.id,
    path: [b.centre, g.position],
    // Straight line plus a 25% allowance for paths around landscaping.
    distanceM: Math.round(distance(b.centre, g.position) * 1.25),
    coveredM: null,
    provenance: {
      source: "TRM estimate from the site plan",
      updated: UPDATED,
      status: "estimated" as const,
      note: "Straight line from the lift core to the gate plus 25%; not a walked route",
    },
  })),
);

const outside = (gateId: string, path: Point[], crossings: string): ExternalRoute => ({
  gateId,
  destination: "Upper Thomson MRT (TE8), Exit 2",
  path,
  distanceM: Math.round(polylineLength(path)),
  coveredM: null,
  crossings,
  provenance: {
    source: "TRM estimate from the site plan",
    updated: UPDATED,
    status: "estimated",
    note: "Measured along the drawn footpath on the plan; not walked",
  },
});

const externalRoutes: ExternalRoute[] = [
  outside("side", [gates[2].position, mrtExit], "None expected; the exit sits beside the side gate"),
  outside("bright-hill", [gates[0].position, P(1330, 300), P(1360, 420), mrtExit], "Along Bright Hill Drive; crossing details not confirmed"),
  outside("sin-ming", [gates[1].position, P(40, 330), P(450, 632), P(1200, 662), mrtExit], "Along Upper Thomson Road; crossing details not confirmed"),
];

const planImageSrc =
  process.env.NEXT_PUBLIC_TR_SITE_PLAN ?? "/thomson-reserve/site-plan.jpg";

export const thomsonReserveDataset: Dataset = {
  project: {
    name: "Thomson Reserve",
    isDemo: false,
    demoNotice: "",
    tenure: "99-year leasehold",
    totalUnits: units.length,
    siteBounds: { width: IMAGE.widthPx / PX_PER_M, height: IMAGE.heightPx / PX_PER_M },
    planNorthDeg: PLAN_NORTH_DEG,
    latitudeDeg: 1.354,
    longitudeDeg: 103.832,
    utcOffsetHours: 8,
    provenance: factsheet("1,268 homes: 2 blocks of 30 storeys and 4 blocks of 21 storeys"),
    display: {
      planImage: {
        src: planImageSrc,
        widthM: IMAGE.widthPx / PX_PER_M,
        heightM: IMAGE.heightPx / PX_PER_M,
        credit: "Site plan: developer's marketing material",
      },
      roadLabels: [],
      mrtLabel: { text: "Upper Thomson MRT, Exit 2", at: mrtExit },
      notice:
        "Thomson Reserve, from the developer's site plan, elevation charts and factsheet: every stack and level with its unit type. Prices and availability are not published yet, and neighbouring building heights are not loaded, so view clearance is not assessed.",
      pricingNote:
        "Awaiting the developer's price list. Prices, premiums and resale scenarios appear once it is loaded.",
    },
  },
  blocks,
  layouts,
  stacks,
  units,
  obstructions,
  viewTargets: [],
  futureSites: [],
  exposureSources,
  gates,
  internalRoutes,
  externalRoutes,
  transactions: [],
  nearbyProjects: [],
};

export const thomsonReserveMrtExit = mrtExit;

/** Known gaps, kept next to the data so they are not forgotten. */
export const thomsonReserveGaps = [
  "Prices and availability: awaiting the developer's price list.",
  "Neighbouring building heights and view targets, needed for the View Clearance Floor Marker.",
  "Exact finished floor levels: level 1 to 2 uses the factsheet's 4.3 m; other floors assume 3.15 m.",
  "Room facings: living and master bedroom are assumed to face away from the lift core until each unit plan is keyed in.",
];
