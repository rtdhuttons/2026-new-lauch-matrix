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

export interface ResaleCompetition {
  /** False until the unit's type and size are known. */
  known: boolean;
  sameLayoutCount: number;
  similarCount: number;
  /** Comparable units that share this unit's view category. */
  sameViewCategoryCount: number;
  distinctive: string[];
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
  /** 0–100; fewer comparables, more distinctive traits and a stronger floor band score higher. */
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
      distinctive: [],
      nearby: [],
      floorEvidence: null,
      evidence: {
        transactions: [],
        note: "Unit types and sizes are not published yet, so similar units cannot be counted.",
      },
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

  const distinctive: string[] = [];
  if (clearish(myCategory) && sameView.length < comparables.length * 0.5) {
    distinctive.push(
      `Estimated clear main view, shared by only ${sameView.length} of ${comparables.length} comparable units`,
    );
  }
  for (const f of layout.features) {
    const share =
      comparables.filter((u) => ix.stackLayout(u.stackId).features.includes(f)).length /
      Math.max(1, comparables.length);
    if (share < 0.5 && f !== "bedroom next to common corridor") {
      distinctive.push(`${f[0].toUpperCase()}${f.slice(1)}, uncommon among comparables`);
    }
  }
  const block = ix.stackBlock(unit.stackId);
  if (unit.level >= block.storeys - 2) distinctive.push("One of the top three floors of its block");

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

  // Exit appeal, out of 100:
  //   competition, up to 50: fewer similar homes in the development score higher
  //   floor band, up to 30: how this floor band resold at the comparable development
  //   distinctive features, 10 each, up to 20
  const competition = 50 * (1 - comparables.length / Math.max(1, ix.ds.units.length - 1));
  const traits = Math.min(20, distinctive.length * 10);
  const score = Math.round(Math.max(0, Math.min(100, competition + (floorEvidence?.points ?? 0) + traits)));

  return {
    known: true,
    sameLayoutCount: sameLayout.length,
    similarCount: comparables.length,
    sameViewCategoryCount: sameView.length,
    distinctive,
    nearby,
    floorEvidence,
    evidence: {
      transactions,
      note:
        transactions.length === 0
          ? "Insufficient evidence: no verified transactions for this layout, so no returns, demand or days-on-market are shown."
          : `${transactions.length} transactions for this layout. Check matching quality before drawing conclusions.`,
    },
    score,
  };
}
