// ILLUSTRATIVE DEMO DATA — fictional surroundings for Wrenfield Residences.
// Heights marked "estimated" are given as ranges to show how uncertainty
// flows into the View Clearance Floor Marker.

import type { FutureSite, Obstruction, Point, ViewTarget } from "../../model/types";
import { blockFootprint, blockTopRL } from "../../lib/geometry";
import { blocks, demo, estimatedDemo } from "./project";

const rect = (x1: number, y1: number, x2: number, y2: number): Point[] => [
  { x: x1, y: y1 },
  { x: x2, y: y1 },
  { x: x2, y: y2 },
  { x: x1, y: y2 },
];

const ownBlocks: Obstruction[] = blocks.map((b) => {
  const top = blockTopRL(b);
  return {
    id: `own-${b.id}`,
    name: `${b.name} (this development)`,
    kind: "own-block",
    footprint: blockFootprint(b),
    baseRL: b.groundRL,
    topRL: { min: top, max: top },
    heightProvenance: demo("From the illustrative storey heights of this development"),
    blockId: b.id,
  };
});

export const obstructions: Obstruction[] = [
  ...ownBlocks,
  {
    id: "tree-belt-west",
    name: "Reservoir Road tree belt (taller canopy)",
    kind: "tree-belt",
    footprint: rect(-150, -70, 90, -22),
    baseRL: 28,
    topRL: { min: 55, max: 61 },
    heightProvenance: estimatedDemo(
      "Canopy height estimated at 27–33 m from typical rain-tree height; not surveyed",
    ),
  },
  {
    id: "tree-belt-east",
    name: "Reservoir Road tree belt (lower canopy)",
    kind: "tree-belt",
    footprint: rect(90, -70, 400, -22),
    baseRL: 27,
    topRL: { min: 46, max: 51 },
    heightProvenance: estimatedDemo("Canopy height estimated at 19–24 m; not surveyed"),
  },
  {
    id: "parkline",
    name: "Parkline Court (existing 12-storey condo)",
    kind: "existing-building",
    footprint: rect(238, -205, 320, -125),
    baseRL: 24,
    topRL: { min: 63, max: 67 },
    heightProvenance: estimatedDemo("Estimated from storey count × 3 m plus roof"),
  },
  {
    id: "avenue-court",
    name: "Avenue Court (existing 14-storey condo)",
    kind: "existing-building",
    footprint: rect(270, 60, 320, 145),
    baseRL: 25,
    topRL: { min: 67, max: 72 },
    heightProvenance: estimatedDemo("Estimated from storey count; roof features unknown"),
  },
  {
    id: "wrenfield-heights",
    name: "Wrenfield Heights (existing 12-storey flats)",
    kind: "existing-building",
    footprint: rect(-110, 80, -60, 165),
    baseRL: 24,
    topRL: { min: 60, max: 64 },
    heightProvenance: estimatedDemo("Estimated from storey count × 2.8 m plus roof"),
  },
  {
    id: "kestrel-view",
    name: "Kestrel View (existing 16-storey flats)",
    kind: "existing-building",
    footprint: rect(282, 168, 326, 236),
    baseRL: 25,
    topRL: { min: 70, max: 74 },
    heightProvenance: estimatedDemo("Estimated from storey count × 2.8 m plus roof"),
  },
  {
    id: "orchid-lodge",
    name: "Orchid Lodge (existing 10-storey condo)",
    kind: "existing-building",
    footprint: rect(-112, -8, -68, 52),
    baseRL: 24,
    topRL: { min: 52, max: 56 },
    heightProvenance: estimatedDemo("Estimated from storey count × 3 m plus roof"),
  },
  {
    id: "landed-south",
    name: "Landed estate (2–3 storeys)",
    kind: "landed-housing",
    footprint: rect(-200, 205, 420, 620),
    baseRL: 26,
    topRL: { min: 34, max: 38 },
    heightProvenance: estimatedDemo("Typical 2–3 storey terrace heights"),
  },
];

export const viewTargets: ViewTarget[] = [
  {
    id: "reservoir",
    name: "Wrenfield Reservoir",
    footprint: rect(-400, -760, 520, -230),
    surfaceRL: 21,
    provenance: demo("Water level used as the view target"),
  },
  {
    id: "ridge",
    name: "Kestrel Ridge (forested)",
    footprint: rect(-1200, 680, 900, 900),
    surfaceRL: 92,
    provenance: demo("Ridge canopy top used as the view target"),
  },
  {
    id: "woodland",
    name: "Western woodland park",
    footprint: rect(-760, -260, -300, 420),
    surfaceRL: 38,
    provenance: demo("Woodland edge canopy used as the view target"),
  },
  {
    id: "skyline",
    name: "City skyline",
    footprint: rect(880, -400, 1300, 600),
    surfaceRL: 115,
    provenance: demo("Mid-height of distant towers used as the view target"),
  },
];

export const futureSites: FutureSite[] = [
  {
    id: "reserve-west",
    name: "Vacant reserve site (west)",
    footprint: rect(-290, -40, -130, 240),
    planningNote:
      "Illustrative: zoned residential with no approved plans. A future tower here could block west-facing views.",
    risk: "high",
    provenance: demo(),
  },
  {
    id: "avenue-court-redevelopment",
    name: "Avenue Court (possible collective sale)",
    footprint: rect(270, 60, 320, 145),
    planningNote:
      "Illustrative: an older condo on land that could be redeveloped at higher density.",
    risk: "moderate",
    provenance: demo(),
  },
  {
    id: "landed-south-zone",
    name: "Landed estate (south)",
    footprint: rect(-200, 205, 420, 620),
    planningNote:
      "Illustrative: landed-housing zone. High-rise redevelopment is unlikely under current zoning, but zoning can change.",
    risk: "low",
    provenance: demo(),
  },
];
