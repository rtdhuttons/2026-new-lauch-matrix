// Builds a project's mini site (a full ProjectBundle) from its data file,
// written by scripts/huttons/build-sites.py from the Huttons New Launch API,
// and, where TRM has traced the developer's site plan, its trace file.
//
// Without a trace the 3D model is schematic: blocks in a row with their stacks
// round a core, clearly labelled as not to plan, and facings marked unknown.
// With a trace, blocks and stacks sit where the site plan shows them, at the
// plan's scale and north point, and homes face away from their lift core.
//
// Nothing here is invented: unknown values stay unknown and are listed as
// gaps. Illustrative prices, used only until a price list is out, come from
// the nearest projects' published prices and say so.

import type {
  AlternativeProject,
  GalleryImage,
  ProjectBundle,
  School,
  SourceRecord,
} from "../../model/project";
import type { Block, Dataset, ExternalRoute, Gate, InternalRoute, Layout, Point, Provenance, Stack, Unit, UnitStatus } from "../../model/types";
import { distance, normaliseBearing } from "../../lib/geometry";

/** [block, stack, floor, floor plan, area sq ft, bedrooms, bathrooms, type, availability, list price, nett price] */
export type AutoUnit = [string, string, number, string, number, number | null, number | null, string | null, UnitStatus, number | null, number | null];

export interface AutoSpec {
  id: string;
  projectId: string;
  name: string;
  fetched: string;
  facts: {
    address: string | null;
    postalCode: string | null;
    district: string | null;
    area: string | null;
    segment: string | null;
    lat: number | null;
    lon: number | null;
    tenure: string | null;
    developer: string | null;
    totalUnits: number | null;
    launchDate: string | null;
    launchNote: string | null;
    completionDate: string | null;
    completionNote: string | null;
    siteArea: string | null;
    description: string | null;
    keyPoints: string | null;
    facilities: string | null;
    nearbyAmenities: string | null;
  };
  units: AutoUnit[];
  floorPlans: { name: string; type: string | null; img: string }[];
  sitePlans: { name: string | null; img: string }[];
  mainImage: string | null;
  images: { title: string | null; img: string }[];
  mrt: { name: string; metres: number; minutes: number | null }[];
  schools: { name: string; metres: number }[];
  nearby: {
    name: string;
    km: number;
    developer: string | null;
    tenure: string | null;
    totalUnits: number | null;
    completion: string | null;
    launchDate: string | null;
    segment: string | null;
    unitTypes: { bedrooms: number; type: string; sizeSqft: { min: number; max: number } | null; fromPrice: number | null; unitsLeft: number | null }[];
  }[];
}

/** TRM's tracing of the developer's site plan, in the image's pixels. */
export interface AutoTrace {
  /** The site plan image traced (one of the spec's site plans). */
  image: string;
  widthPx: number;
  heightPx: number;
  /** From the plan's scale bar. */
  pxPerM: number;
  /** Bearing of the plan's "up", degrees east of true north (from its north point). */
  northDeg: number;
  blocks: {
    /** The block's name in the unit list, e.g. "Blk 32". */
    block: string;
    /** Centre of the block (its lift core). */
    core: [number, number];
    /** Stack positions, where the plan or its key plans show them. */
    stacks?: Record<string, [number, number]>;
  }[];
  /** The plan's own area of the image [x0, y0, x1, y1], leaving out legends and other panels. */
  crop?: [number, number, number, number];
  /** "labelled": stack numbers are on the plan; "arranged": TRM placed the stacks round each block from the key plans or in order. */
  stackPositions: "labelled" | "arranged";
  checked: string;
  notes?: string;
}

const enc = (url: string) => encodeURI(decodeURI(url));
const full = (url: string) => enc(url.replace(/\?quality=\d+$/, ""));

const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
const compass = (b: number) => COMPASS[Math.round(normaliseBearing(b) / 45) % 8];

/** "Blk 32" → "32", "Block 21A" → "21A", otherwise the name without the project's own name. */
function blockLabel(name: string, project: string, i: number): string {
  const m = /\b(?:blk|block|tower)\s*([0-9]+[a-z]?)\b/i.exec(name);
  if (m) return m[1].toUpperCase();
  const rest = name.replace(project, "").replace(/[()]/g, " ").trim();
  return rest && rest.length <= 12 ? rest : String(i + 1);
}

/** Developer's type names in plain words: "2 BEDROOM + STUDY" → "2-Bedroom + Study". */
function category(type: string | null, bedrooms: number | null): string {
  if (!type) return bedrooms ? `${bedrooms}-Bedroom` : "Unit";
  const t = type
    .toLowerCase()
    .replace(/(\d)\s*(?:bedroom|br|bdrm)s?/g, "$1-bedroom")
    .replace(/\s+/g, " ")
    .trim();
  return t.replace(/(^|[\s(+-])([a-z])/g, (_, a: string, c: string) => a + c.toUpperCase()).replace(/\bPes\b/g, "PES");
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
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
  return [...half(pts).slice(0, -1), ...half([...pts].reverse()).slice(0, -1)];
}

const square = (c: Point, size: number, rotDeg: number): Point[] => {
  const r = (rotDeg * Math.PI) / 180;
  const h = size / 2;
  return [
    [-h, -h], [h, -h], [h, h], [-h, h],
  ].map(([x, y]) => ({ x: c.x + x * Math.cos(r) - y * Math.sin(r), y: c.y + x * Math.sin(r) + y * Math.cos(r) }));
};

const planBearing = (from: Point, to: Point) => normaliseBearing((Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI);

/** Stacks in a ring round a core, in number order, starting at plan north. */
function ring(core: Point, ids: string[], radius: number): Record<string, Point> {
  return Object.fromEntries(
    ids.map((id, i) => {
      const a = (i / ids.length) * 2 * Math.PI;
      return [id, { x: core.x + radius * Math.sin(a), y: core.y - radius * Math.cos(a) }];
    }),
  );
}

const tidy = (s: string | null) => (s ? s.replace(/\s+([,.])/g, "$1").replace(/[.,\s]+$/, "").replace(/\s+/g, " ").trim() : s);

export function buildAutoBundle(spec: AutoSpec, trace: AutoTrace | null): ProjectBundle {
  const f = { ...spec.facts, address: tidy(spec.facts.address) };
  const API: Provenance = { source: "Huttons New Launch API", updated: spec.fetched, status: "verified" };
  const DEV: Provenance = { source: "Developer's information (via the Huttons New Launch API)", updated: spec.fetched, status: "verified" };
  const unknown = (note: string): Provenance => ({ source: "Not published yet", updated: spec.fetched, status: "unknown", note });
  const traced = (note: string): Provenance => ({ source: "Traced by TRM from the developer's site plan", updated: trace?.checked ?? spec.fetched, status: "estimated", note });

  // Blocks and stacks from the unit list.
  const blockNames = [...new Set(spec.units.map((u) => u[0]))].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const blockId = new Map<string, string>();
  for (const [i, n] of blockNames.entries()) {
    let id = blockLabel(n, spec.name, i);
    while ([...blockId.values()].includes(id)) id = `${id}′`;
    blockId.set(n, id);
  }
  const stacksOf = new Map<string, string[]>();
  for (const u of spec.units) {
    const list = stacksOf.get(u[0]) ?? [];
    if (!list.includes(u[1])) list.push(u[1]);
    stacksOf.set(u[0], list);
  }
  for (const list of stacksOf.values()) list.sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  // Stack numbers that repeat across blocks get the block in front: "32-01".
  const counts = new Map<string, number>();
  for (const list of stacksOf.values()) for (const s of list) counts.set(s, (counts.get(s) ?? 0) + 1);
  const stackId = (block: string, stack: string) => ((counts.get(stack) ?? 0) > 1 ? `${blockId.get(block)}-${stack}` : stack);

  // Layouts: one per floor plan and size.
  const planByName = new Map(spec.floorPlans.map((p) => [p.name.toUpperCase(), p]));
  const planFor = (code: string) => planByName.get(code.toUpperCase()) ?? planByName.get(code.replace(/\s*\(.*\)$/, "").toUpperCase()) ?? null;
  const layoutKey = (u: AutoUnit) => `${u[3] || "?"}|${u[4]}`;
  const layoutRows = new Map<string, AutoUnit>();
  for (const u of spec.units) if (!layoutRows.has(layoutKey(u))) layoutRows.set(layoutKey(u), u);
  const codeAreas = new Map<string, number>();
  for (const k of layoutRows.keys()) codeAreas.set(k.split("|")[0], (codeAreas.get(k.split("|")[0]) ?? 0) + 1);
  const layoutIdOf = (u: AutoUnit) => ((codeAreas.get(u[3] || "?") ?? 0) > 1 ? `${u[3] || "?"} (${u[4]} sq ft)` : u[3] || "?");
  const layouts: Layout[] = [...layoutRows.values()].map((u) => {
    const plan = planFor(u[3]);
    const cat = category(plan?.type ?? u[7], u[5]);
    return {
      id: layoutIdOf(u),
      name: `Type ${u[3] || "not named"}`,
      category: cat,
      bedrooms: u[5],
      areaSqft: u[4] || null,
      features: /study/i.test(cat) ? ["study"] : [],
      livingOverhangM: 1.8,
      masterOverhangM: 0.6,
      windowHeightM: 2.6,
      provenance: { ...API, note: `${cat}, ${u[4].toLocaleString("en-SG")} sq ft${u[6] ? `, ${u[6]} bathrooms` : ""}. Balcony depth for the sun estimate is assumed.` },
    };
  });

  // Geometry: traced, or schematic.
  const pxPerM = trace?.pxPerM ?? 1;
  const [cx0, cy0, cx1, cy1] = trace?.crop ?? [0, 0, trace?.widthPx ?? 0, trace?.heightPx ?? 0];
  const P = (x: number, y: number): Point => ({ x: (x - cx0) / pxPerM, y: (y - cy0) / pxPerM });
  const planNorth = trace?.northDeg ?? 0;
  const sizeFor = (sqft: number) => Math.min(14, Math.max(7, Math.sqrt((sqft / 10.764) * 1.3)));
  const blocks: Block[] = [];
  const stacks: Stack[] = [];
  const LEVEL1 = 4.5;
  const TYPICAL = 3.15;
  let schematicX = 30;
  for (const name of blockNames) {
    const id = blockId.get(name)!;
    const own = spec.units.filter((u) => u[0] === name);
    const floors = own.map((u) => u[2]);
    const top = Math.max(...floors);
    const first = Math.min(...floors);
    const homeSize = sizeFor(median(own.map((u) => u[4]).filter(Boolean)) ?? 900);
    const ids = stacksOf.get(name)!;
    const t = trace?.blocks.find((b) => b.block === name);
    const radius = Math.max(homeSize, (homeSize * ids.length) / (2 * Math.PI) + homeSize / 2);
    const core = t ? P(...t.core) : { x: schematicX + radius, y: 40 };
    if (!t) schematicX += 2 * radius + 25;
    const placed = ring(core, ids, radius);
    if (t?.stacks) for (const [s, xy] of Object.entries(t.stacks)) if (placed[s]) placed[s] = P(...xy);
    const pos = ids.map((s) => placed[s]);
    const hull = convexHull(pos.flatMap((p) => square(p, homeSize, 0)));
    const xs = hull.map((p) => p.x);
    const ys = hull.map((p) => p.y);
    const noUnits: number[] = [];
    for (let l = first; l <= top; l++) if (!floors.includes(l)) noUnits.push(l);
    blocks.push({
      id,
      name: /^\d/.test(id) ? `Block ${id}` : id,
      centre: core,
      size: { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) },
      rotationDeg: 0,
      storeys: top,
      groundRL: 0,
      level1HeightM: LEVEL1,
      typicalFloorHeightM: TYPICAL,
      roofAllowanceM: 4,
      noUnitLevels: noUnits,
      firstResidentialLevel: first,
      footprint: hull,
      provenance: {
        source: t ? "Traced from the developer's site plan; storeys from the unit list" : "Schematic: storeys from the unit list; position not to plan",
        updated: spec.fetched,
        status: t ? "estimated" : "unknown",
        note: `Homes on levels ${first}–${top}. Floor heights are not published: level 1 is taken as ${LEVEL1} m and other floors as ${TYPICAL} m.`,
      },
    });
    for (const s of ids) {
      const position = placed[s];
      const sid = stackId(name, s);
      const byLayout = new Map<string, number>();
      for (const u of own.filter((x) => x[1] === s)) byLayout.set(layoutIdOf(u), (byLayout.get(layoutIdOf(u)) ?? 0) + 1);
      const main = [...byLayout.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const living = normaliseBearing(planBearing(core, position) + planNorth);
      const facingKnown = !!t;
      stacks.push({
        id: sid,
        blockId: id,
        layoutId: main,
        position,
        livingBearingDeg: living,
        masterBearingDeg: living,
        facingKnown,
        mainView: {
          label: facingKnown ? `Outward, to the ${compass(living)}` : "Not assessed",
          bearingDeg: living,
          coneHalfWidthDeg: 12,
          targetId: "",
          provenance: unknown("What each floor sees over its neighbours has not been assessed yet"),
        },
        footprint: { w: homeSize, d: homeSize, rotationDeg: 0 },
        provenance: t
          ? traced(
              t.stacks?.[s] && trace!.stackPositions === "labelled"
                ? "Stack position from its label on the site plan; facing assumed to point away from the lift core"
                : "Stack placed round its block by TRM; its exact side of the block and facing are not confirmed",
            )
          : unknown("Schematic: the site plan has not been traced yet, so the stack's position and facing are not known"),
      });
    }
  }

  const seen = new Set<string>();
  const units: Unit[] = [];
  for (const u of spec.units) {
    const sid = stackId(u[0], u[1]);
    const id = `${sid}-${String(u[2]).padStart(2, "0")}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const stack = stacks.find((s) => s.id === sid)!;
    const lid = layoutIdOf(u);
    const price = u[10] ?? u[9];
    const plan = planFor(u[3]);
    units.push({
      id,
      stackId: sid,
      level: u[2],
      status: u[8],
      price,
      priceIsEstimate: false,
      typeCode: u[3] || undefined,
      ...(lid !== stack.layoutId ? { layoutId: lid } : {}),
      ...(plan ? { floorPlan: { src: enc(plan.img), mirrored: false, credit: "Developer's floor plan (via the Huttons New Launch API). Not drawn to scale." } } : {}),
      priceProvenance:
        price !== null
          ? { source: "Huttons New Launch API: developer's price list", updated: spec.fetched, status: "verified", note: u[10] !== null && u[9] !== null && u[10] !== u[9] ? `List price $${u[9].toLocaleString("en-SG")}; nett price shown.` : undefined }
          : unknown(u[8] === "sold" ? "Sold; price not published" : "The developer's price for this unit has not been published"),
    });
  }

  // Getting to the MRT: the API's walking distance from the project.
  const station = spec.mrt[0] ?? null;
  const centre: Point = blocks.length
    ? { x: blocks.reduce((a, b) => a + b.centre.x, 0) / blocks.length, y: blocks.reduce((a, b) => a + b.centre.y, 0) / blocks.length }
    : { x: 0, y: 0 };
  const gates: Gate[] = station ? [{ id: "site", name: "Site centre", position: centre, opening: "Entrance positions are not traced yet" }] : [];
  const internalRoutes: InternalRoute[] = station
    ? blocks.map((b) => ({
        blockId: b.id,
        gateId: "site",
        path: [b.centre, centre],
        distanceM: Math.round(distance(b.centre, centre) * 1.25),
        coveredM: null,
        provenance: { source: "TRM estimate", updated: spec.fetched, status: "estimated", note: "From the block to the middle of the site plus 25%; not a walked route." },
      }))
    : [];
  const externalRoutes: ExternalRoute[] = station
    ? [
        {
          gateId: "site",
          destination: `${station.name} MRT`,
          path: [centre],
          distanceM: station.metres,
          coveredM: null,
          crossings: "Not confirmed",
          provenance: {
            source: "Huttons New Launch API, nearby facilities",
            updated: spec.fetched,
            status: "estimated",
            note: `${station.metres.toLocaleString("en-SG")} m walking route from the project's map position${station.minutes ? `, about ${station.minutes} minutes` : ""}. The gate used is not stated.`,
          },
        },
      ]
    : [];

  const planImage =
    trace && spec.sitePlans.some((s) => full(s.img) === full(trace.image))
      ? {
          src: full(trace.image),
          widthM: (cx1 - cx0) / pxPerM,
          heightM: (cy1 - cy0) / pxPerM,
          credit: "Site plan: developer's marketing material",
          ...(trace.crop ? { crop: { x: cx0 / trace.widthPx, y: cy0 / trace.heightPx, w: (cx1 - cx0) / trace.widthPx, h: (cy1 - cy0) / trace.heightPx } } : {}),
        }
      : undefined;

  const dataset: Dataset = {
    project: {
      name: spec.name,
      isDemo: false,
      demoNotice: "",
      tenure: f.tenure ?? "Not published",
      totalUnits: units.length,
      siteBounds: planImage
        ? { width: planImage.widthM, height: planImage.heightM }
        : { width: Math.max(60, ...blocks.map((b) => b.centre.x + b.size.w)), height: Math.max(80, ...blocks.map((b) => b.centre.y + b.size.h)) },
      planNorthDeg: planNorth,
      latitudeDeg: f.lat ?? 1.35,
      longitudeDeg: f.lon ?? 103.82,
      utcOffsetHours: 8,
      heightDatum: "ground level",
      provenance: { ...API, note: `${units.length.toLocaleString("en-SG")} units in ${blocks.length} block${blocks.length === 1 ? "" : "s"}` },
      display: {
        ...(planImage ? { planImage } : {}),
        notice: trace
          ? "Blocks traced from the developer's site plan; units, floor plans and availability from the Huttons New Launch API. Views over the neighbours have not been assessed yet."
          : "Schematic layout: the blocks are not in their real positions and facings are not known yet. Units, floor plans and availability are from the Huttons New Launch API.",
        pricingNote: "Prices from the developer's price list where published.",
      },
    },
    blocks,
    layouts,
    stacks,
    units,
    obstructions: [],
    viewTargets: [],
    futureSites: [],
    exposureSources: [],
    gates,
    internalRoutes,
    externalRoutes,
    transactions: [],
    nearbyProjects: [],
  };

  // Illustrative prices only while nothing is priced: the median psf of the
  // nearest projects' cheapest available units, plus $15 a floor.
  const priced = units.filter((u) => u.price !== null).length;
  const nearbyPsf = spec.nearby.flatMap((n) => n.unitTypes.filter((t) => t.fromPrice && t.sizeSqft).map((t) => t.fromPrice! / ((t.sizeSqft!.min + t.sizeSqft!.max) / 2)));
  const basePsf = priced === 0 && nearbyPsf.length >= 3 ? Math.round(median(nearbyPsf)! / 10) * 10 : null;
  const nearbyNames = spec.nearby.filter((n) => n.unitTypes.some((t) => t.fromPrice)).map((n) => n.name);

  const station0 = station ? `${station.name} MRT` : null;
  const gallery: GalleryImage[] = [
    ...(spec.mainImage ? [{ src: full(spec.mainImage), alt: `${spec.name}. Artist's impression.`, title: spec.name, caption: [f.area, f.district].filter(Boolean).join(" · ") }] : []),
    ...spec.images.slice(0, 7).map((im, i) => ({ src: full(im.img), alt: `${spec.name}${im.title ? `: ${im.title}` : ""}. Artist's impression.`, title: im.title ?? `${spec.name} ${i + 2}`, caption: "Artist's impression from the developer's marketing material." })),
  ];

  // The developer's nearby amenities, grouped by their own headings.
  const groups: { title: string; items: string[] }[] = [];
  for (const line of (f.nearbyAmenities ?? "").split("\n").map((l) => l.trim()).filter(Boolean)) {
    const item = /^(?:\d+[.)]|[-•*])\s*(.+)$/.exec(line);
    if (item && groups.length) {
      if (groups[groups.length - 1].items.length < 6) groups[groups.length - 1].items.push(item[1].replace(/\s+-\s*/, ": "));
    } else if (!item && line.length < 70) groups.push({ title: line.replace(/[:：]$/, ""), items: [] });
  }
  const locationGroups = groups.filter((g) => g.items.length).slice(0, 5);

  const schools: School[] = spec.schools.map((s, i) => ({
    name: s.name,
    levels: ["primary"],
    distance: {
      byAddress: [{ address: `${spec.name} (map position)`, metres: s.metres }],
      method: "on OneMap, as a straight line from the project's map position to the school's address point",
      provenance: { source: "SLA OneMap address search", updated: spec.fetched, status: "verified", note: "MOE's official home-school distance is measured from your address to the school boundary, so it can differ, especially near 1 km and 2 km." },
    },
    distanceCategory: { value: s.metres <= 1000 ? "within-1km" : s.metres <= 2000 ? "1-2km" : "outside-2km", basis: "onemap" },
    p1History: [],
    provenance: { source: "SLA OneMap address search", updated: spec.fetched, status: "verified", note: "Past P1 registration results have not been checked yet." },
    ...(i === 0 && s.metres <= 1000 ? { highlighted: true } : {}),
  }));

  const myBeds = new Set(layouts.map((l) => l.bedrooms).filter((b): b is number => b !== null));
  const alternatives: AlternativeProject[] = spec.nearby.map((n) => ({
    name: n.name,
    tag: `${n.km < 1 ? `${Math.round(n.km * 1000)} m` : `${n.km.toFixed(1)} km`} away`,
    why: `One of the nearest projects on the map with ${[...new Set(n.unitTypes.map((t) => t.bedrooms))].filter((b) => myBeds.has(b)).sort().join(", ")}-bedroom units${n.launchDate && n.launchDate > spec.fetched ? `, launching ${n.launchDate}` : ""}.`,
    bestFor: null,
    developer: n.developer,
    nearestMrt: null,
    totalUnits: n.totalUnits,
    tenure: n.tenure,
    completion: n.completion ? n.completion.slice(0, 4) : null,
    image: null,
    unitTypes: n.unitTypes,
    factsSource: { source: "Huttons New Launch API", checked: spec.fetched },
    priceBasis: "Lowest price among the units still available",
    provenance: { ...API, note: "Lowest price and units left from the developers' sales listings. Availability changes daily." },
    kind: "third-party",
  }));

  const sources: SourceRecord[] = [
    { item: "Project facts, every unit, availability and published prices", kind: "third-party", source: "Huttons New Launch API", checked: spec.fetched, status: "verified" },
    { item: "Floor plans, site plans and renders", kind: "developer", source: "Developer's marketing material (via the Huttons New Launch API)", checked: spec.fetched, status: "verified" },
    trace
      ? { item: "Block and stack positions and facings", kind: "calculated", source: "Traced by TRM from the developer's site plan (scale bar and north point)", checked: trace.checked, status: "estimated", ...(trace.notes ? { note: trace.notes } : {}) }
      : { item: "Block and stack positions", kind: "illustrative", source: "Schematic until the site plan is traced", checked: spec.fetched, status: "unknown" },
    { item: "Floor heights (level 1 4.5 m, other floors 3.15 m)", kind: "illustrative", source: "TRM assumption; not published", checked: spec.fetched, status: "assumed" },
    ...(station ? [{ item: `Walking distance to ${station.name} MRT`, kind: "third-party" as const, source: "Huttons New Launch API, nearby facilities", checked: spec.fetched, status: "estimated" as const }] : []),
    { item: "Primary school distances", kind: "official", source: "SLA OneMap address search", checked: spec.fetched, status: "verified", note: "From the project's map position to each school's address point." },
    { item: "Nearby projects to compare", kind: "third-party", source: "Huttons New Launch API", checked: spec.fetched, status: "verified" },
    ...(basePsf ? [{ item: `Illustrative prices: $${basePsf.toLocaleString("en-SG")} psf at level ${Math.min(...units.map((u) => u.level))} plus $15 psf a floor`, kind: "illustrative" as const, source: `TRM estimate from the cheapest available units at ${nearbyNames.join(", ")} (Huttons New Launch API)`, checked: spec.fetched, status: "assumed" as const }] : []),
  ];

  const unitsText = units.length.toLocaleString("en-SG");
  return {
    id: spec.id,
    status: "live",
    profile: {
      name: spec.name,
      address: f.address ? `${f.address}${f.postalCode ? `, Singapore ${f.postalCode}` : ""}` : null,
      developer: f.developer,
      tenure: f.tenure,
      district: f.district ? `District ${Number(f.district.replace(/\D/g, ""))}${f.area ? ` (${f.area})` : ""}` : null,
      towersSummary: `${blocks.length} block${blocks.length === 1 ? "" : "s"} of up to ${Math.max(...blocks.map((b) => b.storeys))} storeys`,
      nearestMrt: station0,
      expectedCompletion: f.completionDate ? { date: f.completionDate, provenance: { ...API, status: "estimated", note: "Expected completion (Huttons New Launch API)." } } : null,
      launchDate: f.launchDate ? { date: f.launchDate, provenance: API } : null,
      provenance: API,
    },
    copy: {
      eyebrow: [f.address, f.area].filter(Boolean).join(" · ") || spec.name,
      tagline: `${unitsText} units${f.tenure ? `, ${f.tenure.toLowerCase()}` : ""}${station0 ? `, near ${station0}` : ""}. Find your stack and floor, compare floor plans and prices, and work out your payments.`,
      heroFacts: [
        { label: "Units", value: unitsText },
        { label: "Units left", value: units.filter((u) => u.status === "available").length.toLocaleString("en-SG") },
        ...(station ? [{ label: `${station.name} MRT`, value: station.minutes ? `About ${station.minutes} min walk` : `${station.metres.toLocaleString("en-SG")} m` }] : []),
      ],
      cardSummary: `${unitsText} units${f.district ? ` in ${f.district}` : ""}.`,
      galleryTitle: spec.name,
      galleryLede: "Artist's impressions from the developer's marketing material.",
      locationTitle: "Location",
      locationLede: f.description?.split("\n")[0]?.slice(0, 280) ?? "Places nearby, as the developer lists them.",
      disclaimer:
        "This guide is built automatically from the Huttons New Launch API and the developer's plans. Prices are the developer's where published; any other prices are illustrative estimates. Nothing here is the developer's advice. Always check the developer's brochure, price list and sale and purchase agreement.",
    },
    dataset,
    mrtEntrance: null,
    media: { hero: spec.mainImage ? { src: full(spec.mainImage), srcSet: "", alt: `${spec.name}. Artist's impression.` } : null, gallery },
    location: locationGroups.length
      ? { map: null, mapCaption: "", groups: locationGroups, provenance: { ...DEV, note: "As the developer lists them; distances and times not measured by TRM." } }
      : null,
    pricing: {
      estimate: basePsf ? { basePsf, stepPsf: 15 } : null,
      estimateProvenance: basePsf
        ? { source: "TRM illustrative estimate", updated: spec.fetched, status: "assumed", note: `$${basePsf.toLocaleString("en-SG")} psf on the lowest floor plus $15 psf a floor: the median psf of the cheapest available units at ${nearbyNames.join(", ")}. Not the developer's price.` }
        : null,
      priceList: priced > 0 ? { date: spec.fetched, provenance: { ...API, note: `${priced.toLocaleString("en-SG")} units priced` } } : null,
    },
    payments: { schedule: null, scheduleProvenance: null, maintenance: null },
    schools: schools.length ? { measuredFrom: spec.name, registrationYear: null, schools, provenance: { source: "SLA OneMap address search", updated: spec.fetched, status: "verified" } } : null,
    comparables: [],
    rentals: [],
    alternatives,
    pivot: { scores: null, overallStated: null, overallMethod: null, entry: null, provenance: null },
    sources,
    gaps: [
      ...(trace ? [] : ["Site plan tracing: the 3D model is schematic until TRM traces the developer's site plan, so stack positions and facings are not known."]),
      ...(trace?.stackPositions === "arranged" ? ["Stack positions round each block are arranged by TRM; the exact side of the block each stack faces is not confirmed."] : []),
      ...(priced === 0 ? ["Prices: the developer's price list has not been published."] : []),
      "Views over the neighbours: not assessed.",
      "Floor heights: not published (assumed).",
      "Resale and rental evidence nearby, and TRM's PIVOT assessment.",
      "Past P1 registration results for the schools.",
    ],
  };
}
