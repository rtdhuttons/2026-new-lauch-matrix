// View Clearance Floor Marker
//
// "The estimated first floor where the main view clears a nearby
// obstruction."
//
// Method (illustrative, not a survey):
// 1. Cast five rays across the stack's main view cone on the site plan.
// 2. For each ray, find where it first reaches the view target (water,
//    ridge, woodland) and every obstruction it crosses before that.
// 3. A floor clears a ray when the sight line from standing eye height to
//    the target — anywhere within its first 300 m — passes above every
//    obstruction top. The
//    required eye level is solved directly from relative elevations, so
//    ground levels, floor-to-floor heights and distances all count — the
//    floor number alone never decides clearance.
// 4. Obstruction heights are ranges. The lowest plausible height gives an
//    optimistic floor, the highest a conservative one. When they differ,
//    the marker shows a range instead of one falsely precise floor.

import type {
  Block,
  DataStatus,
  FutureRiskLevel,
  FutureSite,
  Obstruction,
  Range,
  Stack,
  ViewTarget,
} from "../model/types";
import type { DatasetIndex } from "./dataset-index";
import { weakestStatus } from "./dataset-index";
import { bearingVector, eyeRL, normaliseBearing, rayPolygonSpan } from "./geometry";

export type ViewCategory = "below" | "partial" | "clear" | "clear-limited" | "unknown";

const isClear = (c: ViewCategory) => c === "clear" || c === "clear-limited";

export const VIEW_CATEGORY_LABEL: Record<ViewCategory, string> = {
  below: "Below obstruction",
  partial: "Partially cleared",
  clear: "Estimated clear view",
  "clear-limited": "Clear, limited further gain",
  unknown: "View not assessed",
};

/** Share of rays that must clear for the view to count as clear. */
export const CLEAR_SHARE = 0.8;
/** Levels above the clearance floor after which extra height adds little. */
export const LIMITED_GAIN_AFTER_LEVELS = 3;
const RAY_OFFSETS = [-1, -0.5, 0, 0.5, 1];
/** How far into the target a sight line may land and still count as a view of it. */
export const TARGET_DEPTH_M = 300;

export interface RayObstacle {
  obstruction: Obstruction;
  near: number;
  far: number;
}

export interface RayAnalysis {
  offsetDeg: number;
  bearingDeg: number;
  /** Distance to the aiming point inside the view target, or null if the ray misses it. */
  targetDistance: number | null;
  obstacles: RayObstacle[];
  /** Eye level needed to see over everything, for low and high height estimates. */
  requiredEyeRL: Range | null;
  governing: RayObstacle | null;
  futureSites: FutureSite[];
}

export interface LevelView {
  level: number;
  eyeRL: number;
  hasHomes: boolean;
  clearedShare: { optimistic: number; conservative: number };
  category: ViewCategory;
  optimisticCategory: ViewCategory;
  /** True when the uncertain obstruction height could change whether this level clears. */
  uncertain: boolean;
}

export interface StackViewAnalysis {
  stack: Stack;
  target: ViewTarget | null;
  rays: RayAnalysis[];
  /** First level that clears, for low and high obstruction heights. */
  clearFrom: { optimistic: number | null; conservative: number | null };
  levels: LevelView[];
  governing: RayObstacle | null;
  futureRisk: { level: FutureRiskLevel; sites: FutureSite[] };
  status: DataStatus;
}

const RISK_ORDER: FutureRiskLevel[] = ["low", "unknown", "moderate", "high"];

/**
 * Eye level at which a sight line to a target at distance `dt` and level
 * `targetRL` just grazes the top of an obstruction edge at distance `d`.
 */
export function requiredEyeForEdge(
  d: number,
  dt: number,
  targetRL: number,
  topRL: number,
): number {
  const r = d / dt;
  if (r >= 1) return Infinity;
  return (topRL - targetRL * r) / (1 - r);
}

function analyseRay(
  ix: DatasetIndex,
  stack: Stack,
  target: ViewTarget,
  offsetDeg: number,
): RayAnalysis {
  const bearingDeg = normaliseBearing(stack.mainView.bearingDeg + offsetDeg);
  const dir = bearingVector(bearingDeg, ix.ds.project.planNorthDeg);
  const targetSpan = rayPolygonSpan(stack.position, dir, target.footprint);
  const futureSites = ix.ds.futureSites.filter((f) => {
    const span = rayPolygonSpan(stack.position, dir, f.footprint);
    return span && (!targetSpan || span.near < targetSpan.near);
  });
  if (!targetSpan) {
    return {
      offsetDeg,
      bearingDeg,
      targetDistance: null,
      obstacles: [],
      requiredEyeRL: null,
      governing: null,
      futureSites,
    };
  }

  // Aim at the deepest point of the target's first 300 m: seeing any water
  // or canopy in that band counts as seeing the target.
  const dt = Math.min(targetSpan.far, targetSpan.near + TARGET_DEPTH_M);
  const obstacles: RayObstacle[] = [];
  for (const o of ix.ds.obstructions) {
    if (o.blockId === stack.blockId) continue;
    const span = rayPolygonSpan(stack.position, dir, o.footprint);
    if (!span || span.near >= targetSpan.near) continue;
    obstacles.push({ obstruction: o, near: span.near, far: Math.min(span.far, targetSpan.near) });
  }

  let low = -Infinity;
  let high = -Infinity;
  let governing: RayObstacle | null = null;
  for (const ob of obstacles) {
    // The critical point is the near edge when the sight line rises and the
    // far edge when it falls; checking both covers either case.
    const edges = [Math.max(ob.near, 1), ob.far];
    for (const d of edges) {
      const lo = requiredEyeForEdge(d, dt, target.surfaceRL, ob.obstruction.topRL.min);
      const hi = requiredEyeForEdge(d, dt, target.surfaceRL, ob.obstruction.topRL.max);
      low = Math.max(low, lo);
      if (hi > high) {
        high = hi;
        governing = ob;
      }
    }
  }

  return {
    offsetDeg,
    bearingDeg,
    targetDistance: dt,
    obstacles,
    requiredEyeRL: obstacles.length ? { min: low, max: high } : { min: -Infinity, max: -Infinity },
    governing,
    futureSites,
  };
}

function categorise(
  share: number,
  level: number,
  clearFrom: number | null,
): ViewCategory {
  if (share <= 0) return "below";
  if (share < CLEAR_SHARE) return "partial";
  if (clearFrom !== null && share >= 1 && level >= clearFrom + LIMITED_GAIN_AFTER_LEVELS) {
    return "clear-limited";
  }
  return "clear";
}

function sharesAt(rays: RayAnalysis[], eye: number) {
  const counted = rays.filter((r) => r.requiredEyeRL);
  if (counted.length === 0) return null;
  const opt = counted.filter((r) => eye >= r.requiredEyeRL!.min).length / counted.length;
  const con = counted.filter((r) => eye >= r.requiredEyeRL!.max).length / counted.length;
  return { optimistic: opt, conservative: con };
}

export function analyseStackView(ix: DatasetIndex, stackId: string): StackViewAnalysis {
  const stack = ix.stack(stackId);
  const block: Block = ix.stackBlock(stackId);
  const target = ix.ds.viewTargets.find((t) => t.id === stack.mainView.targetId) ?? null;
  const levels = ix.levelsForStack(stackId);

  if (!target) {
    return {
      stack,
      target: null,
      rays: [],
      clearFrom: { optimistic: null, conservative: null },
      levels: levels.map((level) => ({
        level,
        eyeRL: eyeRL(block, level),
        hasHomes: !block.noUnitLevels.includes(level),
        clearedShare: { optimistic: 0, conservative: 0 },
        category: "unknown",
        optimisticCategory: "unknown",
        uncertain: false,
      })),
      governing: null,
      futureRisk: { level: "unknown", sites: [] },
      status: "unknown",
    };
  }

  const rays = RAY_OFFSETS.map((f) =>
    analyseRay(ix, stack, target, f * stack.mainView.coneHalfWidthDeg),
  );

  const firstLevel = (pick: "optimistic" | "conservative") => {
    for (const level of levels) {
      const s = sharesAt(rays, eyeRL(block, level));
      if (s && s[pick] >= CLEAR_SHARE) return level;
    }
    return null;
  };
  const clearFrom = { optimistic: firstLevel("optimistic"), conservative: firstLevel("conservative") };

  const levelViews: LevelView[] = levels.map((level) => {
    const eye = eyeRL(block, level);
    const s = sharesAt(rays, eye) ?? { optimistic: 0, conservative: 0 };
    const category = categorise(s.conservative, level, clearFrom.conservative);
    const optimisticCategory = categorise(s.optimistic, level, clearFrom.optimistic);
    return {
      level,
      eyeRL: eye,
      hasHomes: !block.noUnitLevels.includes(level),
      clearedShare: s,
      category,
      optimisticCategory,
      // Only a difference in whether the view clears counts as uncertain;
      // clear versus "clear, limited further gain" is not.
      uncertain: isClear(category) !== isClear(optimisticCategory) ||
        (!isClear(category) && category !== optimisticCategory),
    };
  });

  // The governing obstruction is the one that sets the highest eye level on
  // any ray that reaches the target.
  let governing: RayObstacle | null = null;
  let worst = -Infinity;
  for (const r of rays) {
    if (r.governing && r.requiredEyeRL && r.requiredEyeRL.max > worst) {
      worst = r.requiredEyeRL.max;
      governing = r.governing;
    }
  }

  const sites = [...new Map(rays.flatMap((r) => r.futureSites).map((s) => [s.id, s])).values()];
  const riskLevel = sites.reduce<FutureRiskLevel>(
    (acc, s) => (RISK_ORDER.indexOf(s.risk) > RISK_ORDER.indexOf(acc) ? s.risk : acc),
    "low",
  );

  const statuses: DataStatus[] = [stack.mainView.provenance.status, target.provenance.status];
  for (const r of rays) for (const o of r.obstacles) statuses.push(o.obstruction.heightProvenance.status);

  return {
    stack,
    target,
    rays,
    clearFrom,
    levels: levelViews,
    governing,
    futureRisk: { level: riskLevel, sites },
    status: weakestStatus(statuses),
  };
}

export function levelView(a: StackViewAnalysis, level: number): LevelView | undefined {
  return a.levels.find((l) => l.level === level);
}

/** Human description of the clearance floor, e.g. "Level 14" or "Levels 13–15". */
export function describeClearFrom(a: StackViewAnalysis, topLevel: number): string {
  const { optimistic, conservative } = a.clearFrom;
  if (a.target === null) return "Not assessed";
  if (optimistic === null) return `Not reached below level ${topLevel}`;
  if (conservative === null) return `Level ${optimistic} to above level ${topLevel}`;
  if (optimistic === conservative) return `Level ${optimistic}`;
  return `Levels ${optimistic}–${conservative}`;
}
