// ILLUSTRATIVE DEMO DATA — a fictional project. None of these figures
// describe a real development. Replace this module with verified project
// data (developer site plan, elevation, unit schedule) before real use.

import type { Block, Layout, Project, Provenance, Stack } from "../../model/types";
import { blockLocalPoint, normaliseBearing } from "../../lib/geometry";

export const DEMO_UPDATED = "2026-09-30";

export const demo = (note?: string): Provenance => ({
  source: "TRM illustrative demo data",
  updated: DEMO_UPDATED,
  status: "assumed",
  note,
});

export const estimatedDemo = (note: string): Provenance => ({
  source: "TRM illustrative demo data",
  updated: DEMO_UPDATED,
  status: "estimated",
  note,
});

export const project: Project = {
  name: "Wrenfield Residences",
  isDemo: true,
  demoNotice:
    "Wrenfield Residences is a fictional project. Every price, plan, height, route and exposure figure on this page is illustrative demo data.",
  tenure: "99-year leasehold (illustrative)",
  totalUnits: 0, // filled from the unit list in index.ts
  siteBounds: { width: 240, height: 190 },
  planNorthDeg: 0,
  latitudeDeg: 1.354,
  longitudeDeg: 103.83,
  utcOffsetHours: 8,
  provenance: demo("Fictional project created for the prototype"),
};

const typical = {
  level1HeightM: 4.5,
  typicalFloorHeightM: 3.15,
  roofAllowanceM: 4,
  firstResidentialLevel: 2,
};

export const blocks: Block[] = [
  {
    id: "B1",
    name: "Block 1",
    centre: { x: 62, y: 48 },
    size: { w: 48, h: 20 },
    rotationDeg: 0,
    storeys: 24,
    groundRL: 31,
    noUnitLevels: [],
    ...typical,
    provenance: demo("Illustrative ground level and storey heights"),
  },
  {
    id: "B2",
    name: "Block 2",
    centre: { x: 168, y: 52 },
    size: { w: 48, h: 20 },
    rotationDeg: 30,
    storeys: 24,
    groundRL: 29,
    noUnitLevels: [],
    ...typical,
    provenance: demo("Illustrative ground level and storey heights"),
  },
  {
    id: "B3",
    name: "Block 3",
    centre: { x: 52, y: 128 },
    size: { w: 48, h: 20 },
    rotationDeg: 90,
    storeys: 18,
    groundRL: 27.5,
    noUnitLevels: [],
    ...typical,
    provenance: demo("Illustrative ground level and storey heights"),
  },
  {
    id: "B4",
    name: "Block 4",
    centre: { x: 160, y: 135 },
    size: { w: 48, h: 20 },
    rotationDeg: -20,
    storeys: 30,
    groundRL: 26,
    noUnitLevels: [16],
    ...typical,
    provenance: demo("Level 16 is a sky terrace with no homes"),
  },
];

export const layouts: Layout[] = [
  {
    id: "2A",
    name: "Type 2A",
    bedrooms: 2,
    areaSqft: 614,
    features: [],
    livingOverhangM: 1.6,
    masterOverhangM: 0.6,
    windowHeightM: 2.4,
    provenance: demo(),
  },
  {
    id: "2S",
    name: "Type 2S",
    bedrooms: 2,
    areaSqft: 710,
    features: ["study", "bedroom next to common corridor"],
    livingOverhangM: 1.6,
    masterOverhangM: 0.6,
    windowHeightM: 2.4,
    provenance: demo(),
  },
  {
    id: "3A",
    name: "Type 3A",
    bedrooms: 3,
    areaSqft: 947,
    features: ["enclosed kitchen"],
    livingOverhangM: 1.8,
    masterOverhangM: 0.6,
    windowHeightM: 2.6,
    provenance: demo(),
  },
  {
    id: "3P",
    name: "Type 3P",
    bedrooms: 3,
    areaSqft: 1055,
    features: ["enclosed kitchen", "dual-aspect living"],
    livingOverhangM: 2,
    masterOverhangM: 0.6,
    windowHeightM: 2.6,
    provenance: demo(),
  },
  {
    id: "4P",
    name: "Type 4P",
    bedrooms: 4,
    areaSqft: 1367,
    features: ["private lift lobby", "enclosed kitchen", "dual-aspect living"],
    livingOverhangM: 2,
    masterOverhangM: 0.8,
    windowHeightM: 2.6,
    provenance: demo(),
  },
];

type Corner = "NW" | "NE" | "SE" | "SW";

// Each block has four corner stacks. In the block's own frame the living
// room faces local north (NW, NE corners) or local south (SE, SW), and the
// master bedroom faces local west or east.
const cornerFrame: Record<Corner, { fx: number; fy: number; living: number; master: number }> = {
  NW: { fx: -0.62, fy: -1, living: 0, master: 270 },
  NE: { fx: 0.62, fy: -1, living: 0, master: 90 },
  SE: { fx: 0.62, fy: 1, living: 180, master: 90 },
  SW: { fx: -0.62, fy: 1, living: 180, master: 270 },
};

interface StackSeed {
  id: string;
  blockId: string;
  corner: Corner;
  layoutId: string;
  view: { label: string; targetId: string; bearingOffset?: number };
}

const stackSeeds: StackSeed[] = [
  { id: "01", blockId: "B1", corner: "NW", layoutId: "3P", view: { label: "Reservoir", targetId: "reservoir" } },
  { id: "02", blockId: "B1", corner: "NE", layoutId: "4P", view: { label: "Reservoir", targetId: "reservoir" } },
  { id: "03", blockId: "B1", corner: "SE", layoutId: "2S", view: { label: "Southern ridge over landed homes", targetId: "ridge" } },
  { id: "04", blockId: "B1", corner: "SW", layoutId: "2A", view: { label: "Southern ridge", targetId: "ridge" } },
  { id: "05", blockId: "B2", corner: "NW", layoutId: "3A", view: { label: "Reservoir", targetId: "reservoir" } },
  { id: "06", blockId: "B2", corner: "NE", layoutId: "3P", view: { label: "Reservoir", targetId: "reservoir" } },
  { id: "07", blockId: "B2", corner: "SE", layoutId: "2A", view: { label: "Southern ridge", targetId: "ridge" } },
  { id: "08", blockId: "B2", corner: "SW", layoutId: "2S", view: { label: "Southern ridge between Blocks 3 and 4", targetId: "ridge", bearingOffset: 10 } },
  { id: "09", blockId: "B3", corner: "NW", layoutId: "3A", view: { label: "City skyline to the east", targetId: "skyline" } },
  { id: "10", blockId: "B3", corner: "NE", layoutId: "2A", view: { label: "City skyline to the east", targetId: "skyline" } },
  { id: "11", blockId: "B3", corner: "SE", layoutId: "2S", view: { label: "Western woodland", targetId: "woodland" } },
  { id: "12", blockId: "B3", corner: "SW", layoutId: "3A", view: { label: "Western woodland", targetId: "woodland" } },
  { id: "13", blockId: "B4", corner: "NW", layoutId: "4P", view: { label: "Reservoir", targetId: "reservoir" } },
  { id: "14", blockId: "B4", corner: "NE", layoutId: "3P", view: { label: "Reservoir", targetId: "reservoir" } },
  { id: "15", blockId: "B4", corner: "SE", layoutId: "3A", view: { label: "Southern ridge", targetId: "ridge" } },
  { id: "16", blockId: "B4", corner: "SW", layoutId: "2A", view: { label: "Southern ridge", targetId: "ridge" } },
];

export const stacks: Stack[] = stackSeeds.map((seed) => {
  const block = blocks.find((b) => b.id === seed.blockId)!;
  const frame = cornerFrame[seed.corner];
  const living = normaliseBearing(frame.living + block.rotationDeg);
  return {
    id: seed.id,
    blockId: seed.blockId,
    layoutId: seed.layoutId,
    position: blockLocalPoint(block, frame.fx, frame.fy),
    livingBearingDeg: living,
    masterBearingDeg: normaliseBearing(frame.master + block.rotationDeg),
    mainView: {
      label: seed.view.label,
      bearingDeg: normaliseBearing(living + (seed.view.bearingOffset ?? 0)),
      coneHalfWidthDeg: 12,
      targetId: seed.view.targetId,
      provenance: estimatedDemo("Main view taken as the living-room facing"),
    },
    provenance: demo(),
  };
});
