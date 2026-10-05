// Explainable recommendations.
//
// Rules, in order:
// 1. Essentials filter first: available to buy, within budget, matching
//    bedroom count and, if asked, an estimated clear main view.
// 2. Lifestyle fit = weighted average of the criterion scores the buyer
//    weighted, using ONLY criteria with known values. Coverage (the share of
//    weight that had data) is always shown; unknown values are never filled
//    with an average.
// 3. Best fit for your lifestyle: highest fit among eligible units within
//    the buyer's extra-spend limit, with at least 70% coverage.
// 4. Lowest entry price: cheapest eligible unit.
// 5. Best supported value: the unit that adds the most fit points per
//    $10,000 above the lowest entry price, counting only units with at
//    least 80% coverage and a view category that is not uncertain at that
//    floor, and adding at least 5 fit points. If none qualifies, the lowest
//    entry unit is the value pick.
// 6. Appreciation potential is never ranked without verified transactions.

import type { Unit } from "../model/types";
import type { Criterion, Engine, UnitAssessment } from "./engine";
import { CRITERIA } from "./engine";
import { onOffer } from "./pricing";

export type Purpose = "own" | "invest" | "both";

export interface Preferences {
  purpose: Purpose;
  budget: number;
  bedrooms: number | "any";
  weights: Record<Criterion, number>;
  /** Most the buyer will pay above the lowest eligible price, or null for no limit. */
  maxExtraSpend: number | null;
  requireClearView: boolean;
}

export const PURPOSE_WEIGHTS: Record<Purpose, Record<Criterion, number>> = {
  own: { sun: 4, quiet: 4, view: 3, mrt: 3, resale: 2 },
  invest: { sun: 2, quiet: 2, view: 3, mrt: 5, resale: 5 },
  both: { sun: 3, quiet: 3, view: 3, mrt: 4, resale: 4 },
};

export const DEFAULT_PREFERENCES: Preferences = {
  purpose: "own",
  budget: 2_600_000,
  bedrooms: "any",
  weights: PURPOSE_WEIGHTS.own,
  maxExtraSpend: 400_000,
  requireClearView: false,
};

export const MIN_FIT_COVERAGE = 0.7;
export const MIN_VALUE_COVERAGE = 0.8;
export const MIN_VALUE_GAIN = 5;

export interface Fit {
  score: number | null;
  coverage: number;
  unknown: Criterion[];
  contributions: { criterion: Criterion; weight: number; score: number }[];
}

export function lifestyleFit(a: UnitAssessment, weights: Record<Criterion, number>): Fit {
  let total = 0;
  let known = 0;
  let sum = 0;
  const unknown: Criterion[] = [];
  const contributions: Fit["contributions"] = [];
  for (const { id } of CRITERIA) {
    const w = weights[id];
    if (w <= 0) continue;
    total += w;
    const s = a.scores[id];
    if (s.score === null || s.status === "unknown") {
      unknown.push(id);
      continue;
    }
    known += w;
    sum += w * s.score;
    contributions.push({ criterion: id, weight: w, score: s.score });
  }
  return {
    score: known > 0 ? sum / known : null,
    coverage: total > 0 ? known / total : 0,
    unknown,
    contributions,
  };
}

export type Exclusion =
  | "not-available"
  | "over-budget"
  | "bedrooms"
  | "no-clear-view";

export interface RankedUnit {
  assessment: UnitAssessment;
  fit: Fit;
  eligible: boolean;
  exclusions: Exclusion[];
  /** Price above the lowest eligible price. */
  extraOverEntry: number | null;
  withinExtraLimit: boolean;
}

export function rankUnits(engine: Engine, prefs: Preferences): RankedUnit[] {
  const rows = engine.ix.ds.units.map((unit) => {
    const assessment = engine.assess(unit);
    const layout = engine.ix.unitLayout(unit);
    const exclusions: Exclusion[] = [];
    if (!onOffer(unit)) exclusions.push("not-available");
    if (unit.price !== null && unit.price > prefs.budget) exclusions.push("over-budget");
    if (prefs.bedrooms !== "any" && layout.bedrooms !== prefs.bedrooms) exclusions.push("bedrooms");
    const cat = assessment.level?.category;
    if (prefs.requireClearView && cat !== "clear" && cat !== "clear-limited") {
      exclusions.push("no-clear-view");
    }
    return {
      assessment,
      fit: lifestyleFit(assessment, prefs.weights),
      eligible: exclusions.length === 0,
      exclusions,
      extraOverEntry: null as number | null,
      withinExtraLimit: true,
    };
  });

  const eligible = rows.filter((r) => r.eligible);
  const entry = Math.min(...eligible.map((r) => r.assessment.unit.price!));
  for (const r of eligible) {
    r.extraOverEntry = r.assessment.unit.price! - entry;
    r.withinExtraLimit = prefs.maxExtraSpend === null || r.extraOverEntry <= prefs.maxExtraSpend;
  }
  return rows;
}

export interface Recommendation {
  kind: "best-fit" | "lowest-entry" | "best-value";
  title: string;
  unit: Unit | null;
  ranked: RankedUnit | null;
  reasons: string[];
  tradeOffs: string[];
}

const CRITERION_PHRASE: Record<Criterion, string> = {
  sun: "avoiding afternoon sun",
  quiet: "quiet and privacy",
  view: "views",
  mrt: "MRT convenience",
  resale: "exit appeal",
};
const criterionLabel = (c: Criterion) => CRITERION_PHRASE[c];

function explain(r: RankedUnit): { reasons: string[]; tradeOffs: string[] } {
  const sorted = [...r.fit.contributions].sort(
    (a, b) => b.weight * b.score - a.weight * a.score,
  );
  const reasons = sorted
    .filter((c) => c.score >= 60)
    .slice(0, 2)
    .map((c) => `Scores ${Math.round(c.score)}/100 on ${criterionLabel(c.criterion)} (weight ${c.weight}).`);
  const tradeOffs = sorted
    .filter((c) => c.score < 50 && c.weight > 0)
    .map((c) => `Weaker on ${criterionLabel(c.criterion)}: ${Math.round(c.score)}/100.`);
  for (const u of r.fit.unknown) tradeOffs.push(`No data for ${criterionLabel(u)}; not counted.`);
  const a = r.assessment;
  if (a.level?.uncertain) {
    tradeOffs.push("Its view category is uncertain at this floor because the obstruction height is a range.");
  }
  if (a.view.futureRisk.level === "high" || a.view.futureRisk.level === "moderate") {
    tradeOffs.push(
      `Future view risk is ${a.view.futureRisk.level}: ${a.view.futureRisk.sites.map((s) => s.name).join(", ")}.`,
    );
  }
  return { reasons, tradeOffs };
}

export function recommend(ranked: RankedUnit[]): Recommendation[] {
  const eligible = ranked.filter((r) => r.eligible);
  const empty = (kind: Recommendation["kind"], title: string, why: string): Recommendation => ({
    kind,
    title,
    unit: null,
    ranked: null,
    reasons: [why],
    tradeOffs: [],
  });

  if (eligible.length === 0) {
    const noPrices = ranked.every((r) => r.assessment.unit.price === null);
    const why = noPrices
      ? "No prices are published yet. Recommendations appear once the developer's price list is loaded."
      : "No available unit meets your essentials. Try a higher budget or another bedroom type.";
    return [
      empty("best-fit", "Highest fit for your priorities", why),
      empty("lowest-entry", "Lowest price that meets your needs", why),
      empty("best-value", "Most extra fit for the money", why),
    ];
  }

  const byPrice = [...eligible].sort(
    (a, b) => a.assessment.unit.price! - b.assessment.unit.price!,
  );
  const entry = byPrice[0];

  const fitPool = eligible.filter(
    (r) => r.withinExtraLimit && r.fit.score !== null && r.fit.coverage >= MIN_FIT_COVERAGE,
  );
  const best = [...fitPool].sort(
    (a, b) =>
      b.fit.score! - a.fit.score! || a.assessment.unit.price! - b.assessment.unit.price!,
  )[0];

  const entryFit = entry.fit.score ?? 0;
  let valueBest: RankedUnit | null = null;
  let valueRate = 0;
  for (const r of eligible) {
    if (!r.withinExtraLimit || r.fit.score === null) continue;
    if (r.fit.coverage < MIN_VALUE_COVERAGE || r.assessment.level?.uncertain) continue;
    const extra = r.assessment.unit.price! - entry.assessment.unit.price!;
    const gain = r.fit.score - entryFit;
    if (extra <= 0 || gain < MIN_VALUE_GAIN) continue;
    const rate = gain / (extra / 10_000);
    if (rate > valueRate) {
      valueRate = rate;
      valueBest = r;
    }
  }

  const recs: Recommendation[] = [];

  if (best) {
    const e = explain(best);
    recs.push({
      kind: "best-fit",
      title: "Highest fit for your priorities",
      unit: best.assessment.unit,
      ranked: best,
      reasons: [
        `Highest lifestyle fit (${Math.round(best.fit.score!)}/100) among ${fitPool.length} eligible units within your extra-spend limit.`,
        ...e.reasons,
      ],
      tradeOffs: e.tradeOffs,
    });
  } else {
    recs.push(
      empty(
        "best-fit",
        "Highest fit for your priorities",
        "No eligible unit has enough data on your weighted criteria to rank fairly.",
      ),
    );
  }

  const ee = explain(entry);
  recs.push({
    kind: "lowest-entry",
    title: "Lowest price that meets your needs",
    unit: entry.assessment.unit,
    ranked: entry,
    reasons: [
      `Cheapest of ${eligible.length} units that meet your essentials.`,
      entry.fit.score !== null ? `Lifestyle fit ${Math.round(entry.fit.score)}/100.` : "Lifestyle fit unknown.",
    ],
    tradeOffs: ee.tradeOffs,
  });

  if (valueBest) {
    const ve = explain(valueBest);
    const extra = valueBest.assessment.unit.price! - entry.assessment.unit.price!;
    recs.push({
      kind: "best-value",
      title: "Most extra fit for the money",
      unit: valueBest.assessment.unit,
      ranked: valueBest,
      reasons: [
        `Adds ${Math.round(valueBest.fit.score! - entryFit)} fit points for $${extra.toLocaleString("en-SG")} more than the lowest-priced unit: ${valueRate.toFixed(1)} points per $10,000, the best rate among well-evidenced units.`,
        ...ve.reasons,
      ],
      tradeOffs: ve.tradeOffs,
    });
  } else {
    recs.push({
      kind: "best-value",
      title: "Most extra fit for the money",
      unit: entry.assessment.unit,
      ranked: entry,
      reasons: [
        "No well-evidenced unit adds at least 5 fit points over the lowest-priced unit, so the lowest-priced unit is shown here too.",
      ],
      tradeOffs: ee.tradeOffs,
    });
  }

  return recs;
}

export const APPRECIATION_NOTE =
  "Insufficient evidence to rank appreciation potential: there are no verified repeat-sale transactions for this project.";
