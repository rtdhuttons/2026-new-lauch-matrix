// Calculations for the projects map: distances, nearby and recommended
// projects, and growth (CAGR) from sales records.

import type { CatalogueProject, MarketProject, MarketYear } from "./model";

export interface LatLon {
  lat: number;
  lon: number;
}

/** Great-circle distance in kilometres. */
export function km(a: LatLon, b: LatLon): number {
  const p = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * p) / 2) ** 2 + Math.cos(a.lat * p) * Math.cos(b.lat * p) * Math.sin(((b.lon - a.lon) * p) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export const located = (p: CatalogueProject): p is CatalogueProject & LatLon => p.lat !== null && p.lon !== null;

/** Lowest price still available across all unit types, or null. */
export function fromPrice(p: CatalogueProject, bedrooms?: number | null): number | null {
  const prices = p.unitTypes.filter((t) => (bedrooms ? t.bedrooms === bedrooms : true) && t.fromPrice !== null).map((t) => t.fromPrice!);
  return prices.length ? Math.min(...prices) : null;
}

export function bedroomRange(p: CatalogueProject): number[] {
  return [...new Set(p.unitTypes.map((t) => t.bedrooms))].sort((a, b) => a - b);
}

export type ProjectStatus = "selling" | "upcoming" | "sold-out" | "unknown";

/** Selling (units left), upcoming (launch date ahead), sold out, or not known. */
export function projectStatus(p: CatalogueProject, today: string): ProjectStatus {
  if (p.launchDate && p.launchDate > today) return "upcoming";
  if (p.unitsLeft === null) return "unknown";
  return p.unitsLeft > 0 ? "selling" : "sold-out";
}

export interface Nearby<T> {
  item: T;
  km: number;
}

/** Items within a radius of a point, nearest first. */
export function within<T extends LatLon>(centre: LatLon, items: T[], radiusKm: number): Nearby<T>[] {
  return items
    .map((item) => ({ item, km: km(centre, item) }))
    .filter((n) => n.km <= radiusKm)
    .sort((a, b) => a.km - b.km);
}

export interface Recommendation extends Nearby<CatalogueProject> {
  /** Lowest price for the bedroom types both projects offer. */
  sharedFrom: number | null;
  sharedBedrooms: number[];
  reason: string;
}

/**
 * Other projects a buyer of `p` could also consider: within the radius, with
 * units left and at least one bedroom type in common, nearest first. Prices
 * refresh with every catalogue sync.
 */
export function recommendNearby(p: CatalogueProject, all: CatalogueProject[], today: string, radiusKm = 3, limit = 6): Recommendation[] {
  if (!located(p)) return [];
  const mine = new Set(bedroomRange(p));
  return within(p, all.filter((o) => o.id !== p.id && located(o)) as (CatalogueProject & LatLon)[], radiusKm)
    .map(({ item, km: d }) => {
      const shared = bedroomRange(item).filter((b) => mine.size === 0 || mine.has(b));
      const prices = item.unitTypes.filter((t) => shared.includes(t.bedrooms) && t.fromPrice !== null && (t.unitsLeft ?? 1) > 0).map((t) => t.fromPrice!);
      const sharedFrom = prices.length ? Math.min(...prices) : null;
      const status = projectStatus(item, today);
      const reason = [
        `${d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`} away`,
        shared.length ? `${shared.join(", ")}-bedroom` : null,
        sharedFrom !== null ? `from $${sharedFrom.toLocaleString("en-SG")}` : status === "upcoming" ? "launching soon" : null,
        item.unitsLeft !== null && item.unitsLeft > 0 ? `${item.unitsLeft.toLocaleString("en-SG")} units left` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return { item, km: d, sharedFrom, sharedBedrooms: shared, reason, status };
    })
    .filter((r) => r.status !== "sold-out" && (mine.size === 0 || r.sharedBedrooms.length > 0))
    .slice(0, limit);
}

export interface Cagr {
  rate: number;
  fromYear: number;
  toYear: number;
  fromPsf: number;
  toPsf: number;
  basis: "matched-resales" | "psf-trend";
  note: string;
}

/** Fewest sales in a year for its median to count in the price trend. */
export const MIN_SALES_FOR_TREND = 3;

/**
 * Yearly growth of the median price per sq ft between the first and the
 * latest year with enough sales: (latest ÷ first)^(1 ÷ years) − 1. A guide to
 * how prices moved, not a forecast; a mix of floors, sizes and sale types
 * moves the median too.
 */
export function psfTrendCagr(sales: MarketYear[], minSales = MIN_SALES_FOR_TREND): Cagr | null {
  const years = sales.filter((y) => y.count >= minSales && y.medianPsf > 0).sort((a, b) => a.year - b.year);
  if (years.length < 2) return null;
  const first = years[0];
  const last = years[years.length - 1];
  const span = last.year - first.year;
  if (span < 1) return null;
  return {
    rate: (last.medianPsf / first.medianPsf) ** (1 / span) - 1,
    fromYear: first.year,
    toYear: last.year,
    fromPsf: first.medianPsf,
    toPsf: last.medianPsf,
    basis: "psf-trend",
    note: `Median price per sq ft, ${first.year} to ${last.year} (years with ${minSales}+ sales).`,
  };
}

/** The best CAGR for a development: matched resales where a report gives them, otherwise the price trend. */
export function projectCagr(m: MarketProject): Cagr | null {
  const trend = psfTrendCagr(m.sales);
  if (m.matchedCagr) {
    return {
      rate: m.matchedCagr.rate,
      fromYear: trend?.fromYear ?? 0,
      toYear: trend?.toYear ?? 0,
      fromPsf: trend?.fromPsf ?? 0,
      toPsf: trend?.toPsf ?? 0,
      basis: "matched-resales",
      note: `Average yearly return of ${m.matchedCagr.resales} owners who bought and resold (${m.matchedCagr.source}).`,
    };
  }
  return trend;
}

/** The latest year's median price per sq ft, if any sales. */
export function latestPsf(m: MarketProject): MarketYear | null {
  return [...m.sales].sort((a, b) => b.year - a.year)[0] ?? null;
}

export const money = (n: number) => `$${Math.round(n).toLocaleString("en-SG")}`;
export const pct = (r: number) => `${(r * 100).toFixed(2)}%`;
