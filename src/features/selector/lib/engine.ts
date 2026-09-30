// Wires the individual assessments together with caching so the UI can ask
// for any unit's full picture cheaply.

import type { DataStatus, Dataset, Point, Unit } from "../model/types";
import type { MrtAccess } from "./access";
import { mrtAccess } from "./access";
import type { LevelView, StackViewAnalysis } from "./clearance";
import { analyseStackView, levelView } from "./clearance";
import type { DatasetIndex } from "./dataset-index";
import { indexDataset } from "./dataset-index";
import type { ExposureScreening } from "./exposure";
import { screenExposure } from "./exposure";
import type { ResaleCompetition } from "./resale";
import { resaleCompetition } from "./resale";
import type { ExposureEstimate, SunProvider } from "./solar";
import { geometricSunProvider } from "./solar";

export type Criterion = "sun" | "quiet" | "view" | "mrt" | "resale";

export const CRITERIA: { id: Criterion; label: string }[] = [
  { id: "sun", label: "Avoid afternoon sun" },
  { id: "quiet", label: "Quiet & privacy" },
  { id: "view", label: "Views" },
  { id: "mrt", label: "MRT convenience" },
  { id: "resale", label: "Exit appeal" },
];

export interface CriterionScore {
  score: number | null;
  status: DataStatus;
}

export interface UnitAssessment {
  unit: Unit;
  view: StackViewAnalysis;
  level: LevelView | undefined;
  sun: ExposureEstimate;
  exposure: ExposureScreening;
  mrt: MrtAccess;
  resale: ResaleCompetition;
  scores: Record<Criterion, CriterionScore>;
}

const VIEW_SCORE = { below: 10, partial: 45, clear: 85, "clear-limited": 90 } as const;

/** Afternoon sun of 4 hours or more on the combined facades scores 0. */
export function sunScore(sun: ExposureEstimate): number {
  const combined = 0.6 * sun.living.annualAverageMin + 0.4 * sun.master.annualAverageMin;
  return Math.max(0, Math.min(100, 100 - (combined / 240) * 100));
}

export interface Engine {
  ix: DatasetIndex;
  sunProvider: SunProvider;
  view: (stackId: string) => StackViewAnalysis;
  assess: (unit: Unit) => UnitAssessment;
}

export function createEngine(ds: Dataset, mrtEntrance: Point | null): Engine {
  const ix = indexDataset(ds);
  const sunProvider = geometricSunProvider(ix);
  const views = new Map<string, StackViewAnalysis>();
  const mrts = new Map<string, MrtAccess>();
  const assessments = new Map<string, UnitAssessment>();

  const view = (stackId: string) => {
    let v = views.get(stackId);
    if (!v) {
      v = analyseStackView(ix, stackId);
      views.set(stackId, v);
    }
    return v;
  };

  const mrt = (stackId: string) => {
    let m = mrts.get(stackId);
    if (!m) {
      m = mrtAccess(ix, stackId, mrtEntrance);
      mrts.set(stackId, m);
    }
    return m;
  };

  const assess = (unit: Unit): UnitAssessment => {
    const hit = assessments.get(unit.id);
    if (hit) return hit;
    const v = view(unit.stackId);
    const level = levelView(v, unit.level);
    const sun = sunProvider.estimate(unit);
    const exposure = screenExposure(ix, unit);
    const m = mrt(unit.stackId);
    const resale = resaleCompetition(ix, unit, view);
    const viewCategory = level?.category ?? "unknown";
    const result: UnitAssessment = {
      unit,
      view: v,
      level,
      sun,
      exposure,
      mrt: m,
      resale,
      scores: {
        sun: { score: sunScore(sun), status: sun.status },
        quiet: { score: exposure.score, status: exposure.status },
        view: {
          score: viewCategory === "unknown" ? null : VIEW_SCORE[viewCategory],
          status: viewCategory === "unknown" ? "unknown" : v.status,
        },
        mrt: { score: m.score, status: m.status },
        resale: { score: resale.score, status: resale.known ? "estimated" : "unknown" },
      },
    };
    assessments.set(unit.id, result);
    return result;
  };

  return { ix, sunProvider, view, assess };
}
