// Compares the project's own unit types with alternative projects', size for
// size. Only arithmetic on the figures supplied: the project's prices may be
// illustrative estimates, and say so wherever they are shown.

import type { AlternativeUnitType } from "../model/project";
import type { DatasetIndex } from "./dataset-index";
import type { Unit } from "../model/types";

export interface OwnUnitType {
  /** Unit type and size, e.g. "3-Bedroom Premium|1055": stacks sharing both are one row. */
  key: string;
  bedrooms: number;
  type: string;
  sizeSqft: number;
  /** Lowest price among this type's priced units. */
  fromPrice: number;
  isEstimate: boolean;
  units: number;
}

/** The project's unit types with a bedroom count, size and at least one price, one row per type and size. */
export function ownUnitTypes(units: Unit[], ix: DatasetIndex): OwnUnitType[] {
  const byType = new Map<string, OwnUnitType>();
  for (const u of units) {
    const l = ix.stackLayout(u.stackId);
    if (l.bedrooms === null || l.areaSqft === null || u.price === null) continue;
    const type = l.category ?? l.name;
    const key = `${type}|${l.areaSqft}`;
    const row = byType.get(key);
    if (!row) {
      byType.set(key, { key, bedrooms: l.bedrooms, type, sizeSqft: l.areaSqft, fromPrice: u.price, isEstimate: !!u.priceIsEstimate, units: 1 });
    } else {
      row.units += 1;
      if (u.price < row.fromPrice) {
        row.fromPrice = u.price;
        row.isEstimate = !!u.priceIsEstimate;
      }
    }
  }
  return [...byType.values()].sort((a, b) => a.bedrooms - b.bedrooms || a.sizeSqft - b.sizeSqft);
}

/** The alternative unit type closest in size to one of the project's. */
export function closestBySize<T extends AlternativeUnitType>(own: OwnUnitType, others: T[]): T | null {
  const pool = others.filter((o) => o.bedrooms === own.bedrooms && o.sizeSqft !== null && o.fromPrice !== null);
  if (pool.length === 0) return null;
  const mid = (o: T) => (o.sizeSqft!.min + o.sizeSqft!.max) / 2;
  return pool.reduce((best, o) => (Math.abs(mid(o) - own.sizeSqft) < Math.abs(mid(best) - own.sizeSqft) ? o : best));
}

/** "About 30–62 sqft smaller, and about S$180,000 lower in price." */
export function sizePriceSentence(own: OwnUnitType, other: AlternativeUnitType): string | null {
  if (!other.sizeSqft || other.fromPrice === null) return null;
  const d1 = other.sizeSqft.min - own.sizeSqft;
  const d2 = other.sizeSqft.max - own.sizeSqft;
  const lo = Math.min(Math.abs(d1), Math.abs(d2));
  const hi = Math.max(Math.abs(d1), Math.abs(d2));
  const range = lo === hi ? `${lo.toLocaleString("en-SG")}` : `${lo.toLocaleString("en-SG")}–${hi.toLocaleString("en-SG")}`;
  const size =
    d1 === 0 && d2 === 0 ? "The same size" : d1 >= 0 && d2 >= 0 ? `About ${range} sq ft larger` : d1 <= 0 && d2 <= 0 ? `About ${range} sq ft smaller` : `Within ${hi.toLocaleString("en-SG")} sq ft`;
  const diff = Math.round((other.fromPrice - own.fromPrice) / 1000) * 1000;
  const price = diff === 0 ? "about the same starting price" : `a starting price about S$${Math.abs(diff).toLocaleString("en-SG")} ${diff < 0 ? "lower" : "higher"}`;
  return `${size}, with ${price}.`;
}

/** Which of the project's rows a layout belongs to. */
export function ownTypeKey(layout: { category?: string; name: string; areaSqft: number | null }): string {
  return `${layout.category ?? layout.name}|${layout.areaSqft}`;
}
