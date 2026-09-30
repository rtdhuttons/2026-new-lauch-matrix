// Surroundings of Thomson Reserve, from the architect's agent brief.
//
// The brief's "Surrounded by landed housing" map gives the storey count of
// each landed estate around the site, and its green spaces map places the
// Central Catchment forest (Windsor Nature Park, MacRitchie Reservoir) to the
// west and south-west, beyond the landed estates across Upper Thomson Road.
//
// Storey counts are the brief's; everything turned into metres here is an
// estimate or assumption and says so. Heights are measured from Upper
// Thomson Road beside the site, like the rest of this dataset. Zones are
// drawn as bands parallel to the roads, because the brief's map is a
// diagram, not a survey.

import type { FutureSite, Obstruction, Point, Provenance, ViewTarget } from "../../model/types";

const UPDATED = "2026-09-30";

const storeys = (note: string): Provenance => ({
  source: "Architect's agent brief (surrounding landed housing map)",
  updated: UPDATED,
  status: "estimated",
  note,
});

const assumed = (source: string, note: string): Provenance => ({
  source,
  updated: UPDATED,
  status: "assumed",
  note,
});

/** Outward unit normals at each vertex (averaged at bends so bands join without gaps). */
function vertexNormals(line: Point[], side: 1 | -1): Point[] {
  const seg = line.slice(0, -1).map((a, i) => {
    const b = line[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    return { x: (-(b.y - a.y) / len) * side, y: ((b.x - a.x) / len) * side };
  });
  return line.map((_, i) => {
    const a = seg[Math.max(0, i - 1)];
    const b = seg[Math.min(seg.length - 1, i)];
    const len = Math.hypot(a.x + b.x, a.y + b.y);
    return { x: (a.x + b.x) / len, y: (a.y + b.y) / len };
  });
}

/**
 * Polygon covering the band `inner`–`outer` metres from a polyline, on one
 * side, between vertices `from` and `to`.
 */
function band(line: Point[], side: 1 | -1, inner: number, outer: number, from = 0, to = line.length - 1): Point[] {
  const n = vertexNormals(line, side);
  const at = (i: number, d: number) => ({ x: line[i].x + n[i].x * d, y: line[i].y + n[i].y * d });
  const idx = Array.from({ length: to - from + 1 }, (_, k) => from + k);
  return [...idx.map((i) => at(i, inner)), ...idx.reverse().map((i) => at(i, outer))];
}

// Top of a house above its own ground, plus an allowance for ground a
// little above or below the road. Two storeys with a pitched roof or attic:
// about 7–12 m; three storeys: about 10–16 m.
const TWO_STOREY = { min: 7, max: 12 };
const THREE_STOREY = { min: 10, max: 16 };
const MIXED = { min: 7, max: 16 };

/** How far the landed estates reach before the forest, read from the brief's green spaces map. */
const LANDED_DEPTH_M = 700;
const FOREST_DEPTH_M = 600;
/** Upper Thomson Road half-width plus verge. */
const ROAD_EDGE_M = 20;

export function thomsonReserveSurroundings(roads: {
  /** Upper Thomson Road centreline, north-west to south-east, extended past the site at both ends. */
  upperThomson: Point[];
  /** Index range of `upperThomson` that runs alongside the site. */
  siteFrontage: [number, number];
  /** Bright Hill Drive centreline, north to south, extended past the site. */
  brightHill: Point[];
}): { obstructions: Obstruction[]; viewTargets: ViewTarget[]; futureSites: FutureSite[] } {
  const ut = roads.upperThomson;
  const last = ut.length - 1;
  const [f0, f1] = roads.siteFrontage;

  // Across Upper Thomson Road (outward = side 1), zones by the brief's map,
  // north-west to south-east. Vertex ranges share their end vertex so the
  // zones meet without gaps.
  const zones: { id: string; name: string; from: number; to: number; top: { min: number; max: number }; note: string; gcba?: boolean }[] = [
    {
      id: "landed-west",
      name: "2-storey mixed landed houses, west of Upper Thomson Road",
      from: 0,
      to: f0 + 2,
      top: TWO_STOREY,
      note: "2-storey mixed landed (brief). Top taken as 7–12 m above the road, allowing for roofs and uneven ground.",
    },
    {
      id: "landed-windsor",
      name: "2-storey bungalows and GCBA Windsor Park",
      from: f0 + 2,
      to: f0 + 4,
      top: TWO_STOREY,
      gcba: true,
      note: "2-storey bungalows and the Windsor Park Good Class Bungalow Area (brief). Top taken as 7–12 m above the road.",
    },
    {
      id: "landed-south-west",
      name: "3-storey semi-detached houses, across Upper Thomson Road",
      from: f0 + 4,
      to: f0 + 5,
      top: THREE_STOREY,
      note: "3-storey semi-detached (brief). Top taken as 10–16 m above the road.",
    },
    {
      id: "landed-south",
      name: "2- and 3-storey mixed landed houses, south of the site",
      from: f0 + 5,
      to: last,
      top: MIXED,
      note: "2/3-storey mixed landed (brief). Top taken as 7–16 m above the road.",
    },
  ];

  const obstructions: Obstruction[] = zones.map((z) => ({
    id: z.id,
    name: z.name,
    kind: "landed-housing",
    footprint: band(ut, 1, ROAD_EDGE_M, LANDED_DEPTH_M, z.from, z.to),
    baseRL: 0,
    topRL: z.top,
    heightProvenance: storeys(`${z.note} Trees in the estate and the low-rise commercial building in the brief's view photos are not modelled.`),
  }));

  obstructions.push({
    id: "landed-bright-hill",
    name: "2- and 3-storey landed houses, across Bright Hill Drive",
    kind: "landed-housing",
    footprint: band(roads.brightHill, -1, ROAD_EDGE_M, 600),
    baseRL: 0,
    topRL: MIXED,
    heightProvenance: storeys("2-storey semi-detached and mixed landed, with 3-storey mixed landed further out (brief). Top taken as 7–16 m above the road."),
  });

  // The planted forest band along the site's Upper Thomson Road edge.
  obstructions.push({
    id: "forest-band",
    name: "Forest band along Upper Thomson Road (on site)",
    kind: "tree-belt",
    footprint: band(ut, -1, 12, 40, f0, f1),
    baseRL: 0,
    topRL: { min: 12, max: 20 },
    heightProvenance: assumed(
      "TRM assumption from the architect's site section",
      "Trees on the slope between the road and the site deck. Canopy top assumed 12–20 m above the road from the section drawing; not surveyed.",
    ),
  });

  const viewTargets: ViewTarget[] = [
    {
      id: "catchment-forest",
      name: "the nature reserve forest (Windsor Nature Park to MacRitchie Reservoir)",
      footprint: band(ut, 1, LANDED_DEPTH_M, LANDED_DEPTH_M + FOREST_DEPTH_M),
      surfaceRL: 20,
      provenance: assumed(
        "Architect's agent brief (green spaces map); canopy level assumed",
        "Forest edge placed about 700 m beyond Upper Thomson Road from the brief's map. Canopy assumed about 20 m above the road; not surveyed.",
      ),
    },
  ];

  const futureSites: FutureSite[] = [
    ...zones.map((z) => ({
      id: `future-${z.id}`,
      name: z.name,
      footprint: obstructions.find((o) => o.id === z.id)!.footprint,
      planningNote: z.gcba
        ? "Good Class Bungalow Area: URA planning rules keep it to 2-storey bungalows."
        : "Established landed estate (brief). Master Plan controls not checked here.",
      risk: z.gcba ? ("low" as const) : ("unknown" as const),
      provenance: storeys(z.gcba ? "GCBA named on the brief's map" : "Zoning not verified"),
    })),
  ];

  return { obstructions, viewTargets, futureSites };
}
