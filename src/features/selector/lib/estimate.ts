// Illustrative prices while the developer's price list is not out.
//
// PSF = base PSF at the lowest home level + a fixed step for every floor
// above it. Price = PSF × the unit's strata area, rounded to the nearest
// $1,000. The figures are the user's assumptions (defaults from TRM), never
// the developer's, and every priced unit says so in its provenance.

import type { Dataset, Unit } from "../model/types";

export interface PriceEstimate {
  /** PSF at the lowest level that has homes. */
  basePsf: number;
  /** PSF added for each floor above that level. */
  stepPsf: number;
}

export const DEFAULT_ESTIMATE: PriceEstimate = { basePsf: 2850, stepPsf: 15 };

export function lowestHomeLevel(ds: Dataset): number {
  return Math.min(...ds.units.map((u) => u.level));
}

export function estimatedPsf(level: number, e: PriceEstimate, baseLevel: number): number {
  return e.basePsf + e.stepPsf * (level - baseLevel);
}

/** True when the dataset has no real prices, so an estimate may be shown. */
export function canEstimate(ds: Dataset): boolean {
  return ds.units.every((u) => u.price === null);
}

const fmt = (n: number) => `$${n.toLocaleString("en-SG")}`;

export function describeEstimate(e: PriceEstimate, baseLevel: number): string {
  return `${fmt(e.basePsf)} psf at level ${baseLevel}, plus ${fmt(e.stepPsf)} psf for each floor above`;
}

/**
 * The dataset with an illustrative price on every unit awaiting the price
 * list. Units keep their "pending" status: availability is still unknown.
 * Datasets that already have real prices are returned unchanged.
 */
export function applyPriceEstimate(ds: Dataset, e: PriceEstimate): Dataset {
  if (!canEstimate(ds)) return ds;
  const baseLevel = lowestHomeLevel(ds);
  const areaByStack = new Map(
    ds.stacks.map((s) => [s.id, ds.layouts.find((l) => l.id === s.layoutId)?.areaSqft ?? null]),
  );
  const note = `TRM illustration: ${describeEstimate(e, baseLevel)}. Not the developer's price.`;
  const units: Unit[] = ds.units.map((u) => {
    const area = areaByStack.get(u.stackId);
    if (u.status !== "pending" || area == null) return u;
    const psf = estimatedPsf(u.level, e, baseLevel);
    return {
      ...u,
      price: Math.round((psf * area) / 1000) * 1000,
      priceIsEstimate: true,
      priceProvenance: { source: "TRM price estimate (user settings)", updated: u.priceProvenance.updated, status: "assumed", note },
    };
  });
  const display = ds.project.display && {
    ...ds.project.display,
    pricingNote: `Illustrative prices only: ${describeEstimate(e, baseLevel)}. Change the assumptions under Illustrative prices. Not the developer's price list, and availability is not known.`,
  };
  return { ...ds, units, project: { ...ds.project, display } };
}
