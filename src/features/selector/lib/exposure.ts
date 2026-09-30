// Noise & privacy — SCREENING ASSESSMENT
//
// Qualitative only. No decibel figures are produced or implied. Each source
// is rated "higher", "moderate" or "lower" potential from its distance,
// whether the unit's rooms face it, and whether a building blocks the line
// between them at this floor. Because the line of sight is checked per
// floor, a higher floor can come out MORE exposed (for example once it
// rises above a screening block), not automatically quieter.

import type {
  DataStatus,
  ExposureKind,
  ExposureSource,
  Obstruction,
  Point,
  Unit,
} from "../model/types";
import type { DatasetIndex } from "./dataset-index";
import {
  angleDiff,
  bearingBetween,
  bearingVector,
  compassWords,
  eyeRL,
  nearestOnGeometry,
  rayPolygonSpan,
} from "./geometry";

export type Potential = "higher" | "moderate" | "lower";
export const POTENTIAL_ORDER: Potential[] = ["lower", "moderate", "higher"];

const KIND_RULES: Record<
  ExposureKind,
  { higherWithin: number; moderateWithin: number; ignoreBeyond: number; describe: string; floorNote: string }
> = {
  expressway: {
    higherWithin: 150,
    moderateWithin: 350,
    ignoreBeyond: 700,
    describe: "Potential continuous traffic noise",
    floorNote:
      "Traffic noise often carries to upper floors once they rise above screening walls, trees or buildings.",
  },
  "main-road": {
    higherWithin: 60,
    moderateWithin: 150,
    ignoreBeyond: 260,
    describe: "Potential road traffic noise",
    floorNote:
      "Higher floors are not automatically quieter: they can lose the screening that boundary trees give lower floors.",
  },
  pool: {
    higherWithin: 40,
    moderateWithin: 90,
    ignoreBeyond: 140,
    describe: "Potential pool activity noise",
    floorNote:
      "Deck activity is usually most noticeable on low and middle floors, but upper floors keep a direct line of sight to the deck.",
  },
  playground: {
    higherWithin: 40,
    moderateWithin: 90,
    ignoreBeyond: 140,
    describe: "Potential children's play noise",
    floorNote: "Most noticeable at lower floors facing the play area.",
  },
  tennis: {
    higherWithin: 40,
    moderateWithin: 90,
    ignoreBeyond: 140,
    describe: "Potential ball and floodlight disturbance",
    floorNote: "Floodlights can be visible from many floors facing the court.",
  },
  "arrival-court": {
    higherWithin: 35,
    moderateWithin: 80,
    ignoreBeyond: 120,
    describe: "Potential drop-off, delivery and taxi activity",
    floorNote: "Mostly affects lower floors; headlights can reach higher floors at night.",
  },
  "vehicle-ramp": {
    higherWithin: 35,
    moderateWithin: 80,
    ignoreBeyond: 120,
    describe: "Potential vehicle ramp noise",
    floorNote: "Mostly affects lower floors close to the ramp entrance.",
  },
  walkway: {
    higherWithin: 10,
    moderateWithin: 20,
    ignoreBeyond: 30,
    describe: "Potential footfall and voices from the common walkway",
    floorNote: "Applies at every floor with the same layout.",
  },
};

const SOURCE_HEIGHT_M = 1.5;

export interface NoiseFinding {
  source: ExposureSource;
  /** Nearest point of the source to the unit's stack, on plan. */
  point: Point;
  distanceM: number;
  direction: string;
  exposedRooms: string[];
  lineOfSight: "direct" | "screened";
  screenedBy: string | null;
  potential: Potential;
  description: string;
  floorNote: string;
}

export interface PrivacyFinding {
  kind: "facing-windows" | "corridor" | "overlooks-roof";
  room: string;
  description: string;
  distanceM: number | null;
  potential: Potential | null;
}

export interface ExposureScreening {
  unitId: string;
  noise: NoiseFinding[];
  privacy: PrivacyFinding[];
  /** 0–100 where 100 means no notable sources found in this screening. */
  score: number;
  status: DataStatus;
}

function lower(p: Potential): Potential {
  return POTENTIAL_ORDER[Math.max(0, POTENTIAL_ORDER.indexOf(p) - 1)];
}

function blockerBetween(
  ix: DatasetIndex,
  from: Point,
  fromRL: number,
  to: Point,
  ownBlockId: string,
): Obstruction | null {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  if (dist < 1) return null;
  const dir = { x: (to.x - from.x) / dist, y: (to.y - from.y) / dist };
  for (const o of ix.ds.obstructions) {
    if (o.blockId === ownBlockId) continue;
    if (o.kind === "tree-belt" || o.kind === "landed-housing") continue;
    const span = rayPolygonSpan(from, dir, o.footprint);
    if (!span || span.near >= dist) continue;
    // Straight sound path from the window down to a ground-level source.
    const targetRL = o.baseRL + SOURCE_HEIGHT_M;
    const pathAtNear = fromRL + ((targetRL - fromRL) * span.near) / dist;
    if (o.topRL.min > pathAtNear) return o;
  }
  return null;
}

const PENALTY: Record<Potential, number> = { higher: 22, moderate: 10, lower: 3 };

export function screenExposure(ix: DatasetIndex, unit: Unit): ExposureScreening {
  const stack = ix.stack(unit.stackId);
  const block = ix.stackBlock(unit.stackId);
  const layout = ix.stackLayout(unit.stackId);
  const eye = eyeRL(block, unit.level);
  const north = ix.ds.project.planNorthDeg;

  const noise: NoiseFinding[] = [];
  for (const source of ix.ds.exposureSources) {
    const rule = KIND_RULES[source.kind];
    const nearest = nearestOnGeometry(stack.position, source.geometry);
    if (nearest.distance > rule.ignoreBeyond) continue;
    const bearing = bearingBetween(stack.position, nearest.point, north);
    const rooms: string[] = [];
    if (Math.abs(angleDiff(bearing, stack.livingBearingDeg)) <= 90) rooms.push("Living room");
    if (Math.abs(angleDiff(bearing, stack.masterBearingDeg)) <= 90) rooms.push("Master bedroom");
    const blocker = blockerBetween(ix, stack.position, eye, nearest.point, stack.blockId);

    let potential: Potential =
      nearest.distance <= rule.higherWithin
        ? "higher"
        : nearest.distance <= rule.moderateWithin
          ? "moderate"
          : "lower";
    if (blocker) potential = lower(potential);
    if (rooms.length === 0) potential = lower(potential);

    noise.push({
      source,
      point: nearest.point,
      distanceM: Math.round(nearest.distance),
      direction: compassWords(bearing),
      exposedRooms: rooms,
      lineOfSight: blocker ? "screened" : "direct",
      screenedBy: blocker?.name ?? null,
      potential,
      description: rule.describe,
      floorNote: rule.floorNote,
    });
  }
  noise.sort(
    (a, b) =>
      POTENTIAL_ORDER.indexOf(b.potential) - POTENTIAL_ORDER.indexOf(a.potential) ||
      a.distanceM - b.distanceM,
  );

  const privacy: PrivacyFinding[] = [];
  const rooms: { room: string; bearing: number }[] = [
    { room: "Living room", bearing: stack.livingBearingDeg },
    { room: "Master bedroom", bearing: stack.masterBearingDeg },
  ];
  for (const { room, bearing } of rooms) {
    let best: { o: Obstruction; d: number } | null = null;
    for (const offset of [-10, 0, 10]) {
      const dir = bearingVector(bearing + offset, north);
      for (const o of ix.ds.obstructions) {
        if (o.blockId === stack.blockId) continue;
        if (o.kind !== "own-block" && o.kind !== "existing-building") continue;
        const span = rayPolygonSpan(stack.position, dir, o.footprint);
        if (!span || span.near > 80) continue;
        if (!best || span.near < best.d) best = { o, d: span.near };
      }
    }
    if (!best) continue;
    const d = Math.round(best.d);
    if (eye > best.o.topRL.max) {
      privacy.push({
        kind: "overlooks-roof",
        room,
        description: `Looks over the roof of ${best.o.name}; no facing windows at this height.`,
        distanceM: d,
        potential: null,
      });
    } else {
      const potential: Potential = d < 30 ? "higher" : d < 50 ? "moderate" : "lower";
      privacy.push({
        kind: "facing-windows",
        room,
        description: `Direct line of sight to windows in ${best.o.name}, about ${d} m away.`,
        distanceM: d,
        potential,
      });
    }
  }
  if (layout.features.includes("bedroom next to common corridor")) {
    privacy.push({
      kind: "corridor",
      room: "Bedroom 2",
      description:
        "A bedroom window opens onto the common corridor. Neighbours passing can see in unless blinds are drawn.",
      distanceM: null,
      potential: "moderate",
    });
  }

  let penalty = 0;
  for (const n of noise) penalty += PENALTY[n.potential];
  for (const p of privacy) if (p.potential) penalty += PENALTY[p.potential];

  return {
    unitId: unit.id,
    noise,
    privacy,
    score: Math.max(0, 100 - penalty),
    status: "estimated",
  };
}

export const POTENTIAL_LABEL: Record<Potential, string> = {
  higher: "Higher potential",
  moderate: "Moderate potential",
  lower: "Lower potential",
};
