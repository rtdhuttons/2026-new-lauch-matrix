// Resale competition & exit appeal.
//
// "How many similar units could a future buyer choose instead of yours?"
// The count is potential competition, not a prediction that those owners
// will sell at the same time. No returns, demand or days-on-market figures
// are shown unless transaction records support them.

import type { NearbyProject, Transaction, Unit } from "../model/types";
import type { StackViewAnalysis } from "./clearance";
import { levelView } from "./clearance";
import type { BandStats } from "./comparable";
import { floorBandPoints } from "./comparable";
import type { DatasetIndex } from "./dataset-index";

export const SIMILAR_SIZE_SHARE = 0.1;
/** Most points a unit can earn: 50 for less competition plus 30 for its floor band. */
export const EXIT_APPEAL_POINTS = 80;

export interface ResaleCompetition {
  /** False until the unit's type and size are known. */
  known: boolean;
  sameLayoutCount: number;
  similarCount: number;
  /** Comparable units that share this unit's view category. */
  sameViewCategoryCount: number;
  nearby: { project: NearbyProject; units: number }[];
  evidence: {
    transactions: Transaction[];
    note: string;
  };
  /**
   * How this unit's floor band did at a comparable development, and the
   * exit-appeal points it adds (0–10). Null without a comparable.
   */
  floorEvidence: { project: string; band: BandStats; points: number } | null;
  /** Points for less competition, 0–50. */
  competitionPoints: number | null;
  /** Competition plus floor band points, out of 80. */
  points: number | null;
  /** 0–100: the 80 points rescaled. Fewer comparables and a stronger floor band score higher. */
  score: number | null;
}

export function resaleCompetition(
  ix: DatasetIndex,
  unit: Unit,
  viewOf: (stackId: string) => StackViewAnalysis,
): ResaleCompetition {
  const layout = ix.stackLayout(unit.stackId);
  const area = layout.areaSqft;
  if (layout.bedrooms === null || area === null) {
    return {
      known: false,
      sameLayoutCount: 0,
      similarCount: 0,
      sameViewCategoryCount: 0,
      nearby: [],
      floorEvidence: null,
      evidence: {
        transactions: [],
        note: "Unit types and sizes are not published yet, so similar units cannot be counted.",
      },
      competitionPoints: null,
      points: null,
      score: null,
    };
  }
  const comparables = ix.ds.units.filter((u) => {
    if (u.id === unit.id) return false;
    const l = ix.stackLayout(u.stackId);
    return (
      l.bedrooms === layout.bedrooms &&
      l.areaSqft !== null &&
      Math.abs(l.areaSqft - area) <= area * SIMILAR_SIZE_SHARE
    );
  });
  const sameLayout = comparables.filter((u) => ix.stackLayout(u.stackId).id === layout.id);

  const myCategory = levelView(viewOf(unit.stackId), unit.level)?.category ?? "unknown";
  const clearish = (c: string) => c === "clear" || c === "clear-limited";
  const sameView = comparables.filter((u) => {
    const c = levelView(viewOf(u.stackId), u.level)?.category ?? "unknown";
    return clearish(myCategory) ? clearish(c) : c === myCategory;
  });

  const nearby = ix.ds.nearbyProjects
    .map((p) => ({
      project: p,
      units: p.comparable
        .filter((c) => c.bedrooms === layout.bedrooms)
        .reduce((a, c) => a + c.units, 0),
    }))
    .filter((n) => n.units > 0);

  const transactions = ix.ds.transactions.filter((t) => {
    const u = ix.unit(t.unitId);
    return u && ix.stackLayout(u.stackId).id === layout.id;
  });

  const fb = floorBandPoints(ix.ds.comparable, unit.level);
  const floorEvidence = fb && ix.ds.comparable ? { project: ix.ds.comparable.name, ...fb } : null;

  // Exit appeal, out of 100, from two parts worth 80 points together:
  //   competition, up to 50: fewer similar homes in the development score higher
  //   floor band, up to 30: how this floor band resold at the comparable development
  // The 80 points are rescaled to 100 (distinctive features were dropped at TRM's request).
  const competition = 50 * (1 - comparables.length / Math.max(1, ix.ds.units.length - 1));
  const points = Math.max(0, Math.min(EXIT_APPEAL_POINTS, competition + (floorEvidence?.points ?? 0)));
  const score = Math.round((points / EXIT_APPEAL_POINTS) * 100);

  return {
    known: true,
    sameLayoutCount: sameLayout.length,
    similarCount: comparables.length,
    sameViewCategoryCount: sameView.length,
    nearby,
    floorEvidence,
    evidence: {
      transactions,
      note:
        transactions.length === 0
          ? "Insufficient evidence: no verified transactions for this layout, so no returns, demand or days-on-market are shown."
          : `${transactions.length} transactions for this layout. Check matching quality before drawing conclusions.`,
    },
    competitionPoints: competition,
    points,
    score,
  };
}
