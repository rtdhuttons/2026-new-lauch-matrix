// Entry price & premium. Only published prices of available units are
// used. Prices for sold, reserved or unreleased units are never
// interpolated from neighbouring floors.

import type { Layout, Obstruction, Unit } from "../model/types";
import type { StackViewAnalysis, ViewCategory } from "./clearance";
import { VIEW_CATEGORY_LABEL, levelView } from "./clearance";
import type { DatasetIndex } from "./dataset-index";

/**
 * A unit that can be priced and compared: on sale with a published price, or
 * awaiting the price list but carrying an illustrative estimate.
 */
export function onOffer(u: Unit): boolean {
  return u.price !== null && (u.status === "available" || u.status === "pending");
}

export function psf(ix: DatasetIndex, unit: Unit): number | null {
  const area = ix.stackLayout(unit.stackId).areaSqft;
  if (unit.price === null || area === null) return null;
  return unit.price / area;
}

export interface LikeForLike {
  sameLayout: boolean;
  differences: string[];
}

/** What makes two units' prices not directly comparable. */
export function compareLayouts(a: Layout, b: Layout): LikeForLike {
  const differences: string[] = [];
  if (a.bedrooms === null || b.bedrooms === null || a.areaSqft === null || b.areaSqft === null) {
    if (a.id !== b.id) differences.push("unit types not confirmed yet");
  } else if (a.bedrooms !== b.bedrooms) differences.push(`${a.bedrooms} vs ${b.bedrooms} bedrooms`);
  if (a.areaSqft !== null && b.areaSqft !== null && a.areaSqft !== b.areaSqft) {
    const diff = a.areaSqft - b.areaSqft;
    differences.push(`${diff > 0 ? "+" : "−"}${Math.abs(diff).toLocaleString("en-SG")} sq ft`);
  }
  const onlyA = a.features.filter((f) => !b.features.includes(f));
  const onlyB = b.features.filter((f) => !a.features.includes(f));
  if (onlyA.length) differences.push(`has ${onlyA.join(", ")}`);
  if (onlyB.length) differences.push(`lacks ${onlyB.join(", ")}`);
  return { sameLayout: a.id === b.id, differences };
}

export interface Premium {
  amount: number;
  /** Premium per floor, only for the same layout in the same stack. */
  perFloor: number | null;
  likeForLike: LikeForLike;
}

export function premiumOver(ix: DatasetIndex, unit: Unit, reference: Unit): Premium | null {
  if (unit.price === null || reference.price === null) return null;
  const likeForLike = compareLayouts(ix.stackLayout(unit.stackId), ix.stackLayout(reference.stackId));
  const sameStack = unit.stackId === reference.stackId && unit.level !== reference.level;
  return {
    amount: unit.price - reference.price,
    perFloor: sameStack ? (unit.price - reference.price) / (unit.level - reference.level) : null,
    likeForLike,
  };
}

const CLEAR: ViewCategory[] = ["clear", "clear-limited"];

export interface ClearanceCost {
  /** Highest available unit clearly below the clearance range. */
  below: Unit | null;
  /** Lowest available unit at or above the conservative clearance floor. */
  firstClear: Unit | null;
  /** Extra paid to reach view clearance within this stack. */
  costToClear: number | null;
  /** Extra paid for the selected unit above the first clear unit. */
  extraAboveClear: number | null;
}

export function clearanceCost(
  ix: DatasetIndex,
  view: StackViewAnalysis,
  selected: Unit,
): ClearanceCost {
  const available = ix
    .unitsInStack(selected.stackId)
    .filter(onOffer);
  const { optimistic, conservative } = view.clearFrom;
  const below =
    optimistic === null
      ? null
      : [...available].reverse().find((u) => u.level < optimistic) ?? null;
  const firstClear =
    conservative === null ? null : available.find((u) => u.level >= conservative) ?? null;
  const costToClear =
    below && firstClear ? firstClear.price! - below.price! : null;
  const selectedClear = CLEAR.includes(levelView(view, selected.level)?.category ?? "unknown");
  const extraAboveClear =
    firstClear && selected.price !== null && selectedClear && selected.level > firstClear.level
      ? selected.price - firstClear.price!
      : null;
  return { below, firstClear, costToClear, extraAboveClear };
}

/** "the Reservoir Road tree belt", "Parkline Court", "Block 3". */
function obstructionName(o: Obstruction): string {
  const name = o.name.replace(/ \(.*\)$/, "");
  return o.kind === "tree-belt" || o.kind === "landed-housing" ? `the ${name}` : name;
}

const money = (n: number) =>
  `$${Math.abs(Math.round(n)).toLocaleString("en-SG")}`;

/**
 * Plain-English walk up the stack, e.g. "Level 14 is estimated to clear the
 * tree belt. It costs $45,000 more than level 11. Level 20 costs another
 * $70,000 and remains in the same view category."
 */
export function clearanceNarrative(
  ix: DatasetIndex,
  view: StackViewAnalysis,
  selected: Unit,
): string[] {
  const lines: string[] = [];
  const cost = clearanceCost(ix, view, selected);
  const obstacle = view.governing ? obstructionName(view.governing.obstruction) : "the nearest obstruction";
  const { optimistic, conservative } = view.clearFrom;

  if (view.target === null) return ["This stack's main view has not been assessed."];
  if (optimistic === null) {
    lines.push(
      `No floor in this stack is estimated to clear ${obstacle} towards ${view.target.name}.`,
    );
    return lines;
  }
  if (conservative === null) {
    lines.push(
      `Clearing ${obstacle} depends on its exact height: the view may open from level ${optimistic}, or not at all in this stack.`,
    );
  } else if (optimistic !== conservative) {
    lines.push(
      `Level ${conservative} is estimated to clear ${obstacle}; if it is at the low end of its height range, level ${optimistic} may already clear.`,
    );
  } else if (optimistic === ix.levelsForStack(selected.stackId)[0]) {
    lines.push(`Every floor in this stack is estimated to have a clear main view.`);
  } else {
    lines.push(`Level ${conservative} is estimated to clear ${obstacle}.`);
  }

  if (cost.firstClear && cost.below && cost.costToClear !== null) {
    lines.push(
      `The first available clear unit, level ${cost.firstClear.level}, costs ${money(cost.costToClear)} ${cost.costToClear >= 0 ? "more" : "less"} than level ${cost.below.level}, the highest available unit below the clearance range.`,
    );
  }
  if (cost.extraAboveClear !== null && cost.firstClear) {
    const sel = levelView(view, selected.level);
    lines.push(
      `Level ${selected.level} costs another ${money(cost.extraAboveClear)} and is in the "${VIEW_CATEGORY_LABEL[sel?.category ?? "unknown"]}" category.`,
    );
  }
  return lines;
}
