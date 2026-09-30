import type { Block, Point } from "../model/types";

const DEG = Math.PI / 180;

/** Unit vector for a compass bearing on the plan (x east, y south). */
export function bearingVector(bearingDeg: number, planNorthDeg = 0): Point {
  const b = (bearingDeg - planNorthDeg) * DEG;
  return { x: Math.sin(b), y: -Math.cos(b) };
}

export function normaliseBearing(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Signed smallest difference a − b, in (−180, 180]. */
export function angleDiff(a: number, b: number): number {
  const d = normaliseBearing(a - b);
  return d > 180 ? d - 360 : d;
}

export function bearingBetween(from: Point, to: Point, planNorthDeg = 0): number {
  const deg = Math.atan2(to.x - from.x, -(to.y - from.y)) / DEG;
  return normaliseBearing(deg + planNorthDeg);
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const COMPASS_WORDS = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
];

export function compassPoint(bearingDeg: number): string {
  return COMPASS[Math.round(normaliseBearing(bearingDeg) / 45) % 8];
}

export function compassWords(bearingDeg: number): string {
  return COMPASS_WORDS[Math.round(normaliseBearing(bearingDeg) / 45) % 8];
}

export function rotate(p: Point, deg: number): Point {
  const r = deg * DEG;
  return {
    x: p.x * Math.cos(r) - p.y * Math.sin(r),
    y: p.x * Math.sin(r) + p.y * Math.cos(r),
  };
}

export function blockFootprint(block: Block): Point[] {
  const { w, h } = block.size;
  const local = [
    { x: -w / 2, y: -h / 2 },
    { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 },
    { x: -w / 2, y: h / 2 },
  ];
  return local.map((p) => {
    const r = rotate(p, block.rotationDeg);
    return { x: block.centre.x + r.x, y: block.centre.y + r.y };
  });
}

/** Point on a block given local coordinates (fractions of half-size). */
export function blockLocalPoint(block: Block, fx: number, fy: number): Point {
  const r = rotate(
    { x: (fx * block.size.w) / 2, y: (fy * block.size.h) / 2 },
    block.rotationDeg,
  );
  return { x: block.centre.x + r.x, y: block.centre.y + r.y };
}

/**
 * Distances along a ray at which it enters and leaves a polygon, or null
 * if it misses. Distances are clamped at 0 when the origin is inside.
 */
export function rayPolygonSpan(
  origin: Point,
  dir: Point,
  polygon: Point[],
): { near: number; far: number } | null {
  const hits: number[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const denom = dir.x * ey - dir.y * ex;
    if (Math.abs(denom) < 1e-12) continue;
    const t = ((a.x - origin.x) * ey - (a.y - origin.y) * ex) / denom;
    const u = ((a.x - origin.x) * dir.y - (a.y - origin.y) * dir.x) / denom;
    if (t >= 0 && u >= 0 && u <= 1) hits.push(t);
  }
  if (hits.length === 0) return null;
  hits.sort((x, y) => x - y);
  if (hits.length === 1) return { near: 0, far: hits[0] };
  return { near: hits[0], far: hits[hits.length - 1] };
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/** Nearest point on a point-or-polyline geometry, with its distance. */
export function nearestOnGeometry(
  p: Point,
  geometry: Point[],
): { point: Point; distance: number } {
  if (geometry.length === 1) {
    return { point: geometry[0], distance: distance(p, geometry[0]) };
  }
  let best = { point: geometry[0], distance: Infinity };
  for (let i = 0; i < geometry.length - 1; i++) {
    const a = geometry[i];
    const b = geometry[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t =
      len2 === 0
        ? 0
        : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    const q = { x: a.x + t * dx, y: a.y + t * dy };
    const d = distance(p, q);
    if (d < best.distance) best = { point: q, distance: d };
  }
  return best;
}

export function polylineLength(path: Point[]): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) total += distance(path[i], path[i + 1]);
  return total;
}

/** Finished floor level of a storey, metres SHD. Level 1 sits on ground. */
export function floorRL(block: Block, level: number): number {
  if (level <= 1) return block.groundRL;
  return (
    block.groundRL + block.level1HeightM + (level - 2) * block.typicalFloorHeightM
  );
}

/** Standing eye height used for view and privacy lines. */
export const EYE_HEIGHT_M = 1.5;

export function eyeRL(block: Block, level: number): number {
  return floorRL(block, level) + EYE_HEIGHT_M;
}

export function blockTopRL(block: Block): number {
  return (
    floorRL(block, block.storeys) + block.typicalFloorHeightM + block.roofAllowanceM
  );
}

const COMPASS_16 = [
  "north", "north-north-east", "north-east", "east-north-east",
  "east", "east-south-east", "south-east", "south-south-east",
  "south", "south-south-west", "south-west", "west-south-west",
  "west", "west-north-west", "north-west", "north-north-west",
];

/** Sixteen-point compass direction in words, e.g. "west-south-west". */
export function compassWords16(bearingDeg: number): string {
  return COMPASS_16[Math.round(normaliseBearing(bearingDeg) / 22.5) % 16];
}
