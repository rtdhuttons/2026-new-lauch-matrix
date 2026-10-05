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

/**
 * On the map: launching later, or no units released yet (upcoming), or
 * launched with units still for sale (new launch). Sold-out projects are not shown.
 */
export type MapKind = "new" | "upcoming";
export const mapKind = (p: CatalogueProject, today: string): MapKind =>
  (p.launchDate && p.launchDate > today) || p.unitsLeft === null ? "upcoming" : "new";
export const onMap = (p: CatalogueProject, today: string) => projectStatus(p, today) !== "sold-out";

export interface PriceRow {
  bedrooms: number;
  loPsf: number | null;
  hiPsf: number | null;
  loPrice: number | null;
  hiPrice: number | null;
  unitsLeft: number | null;
}

/** Lowest and highest price and price per sq ft of the available units, by number of bedrooms. */
export function priceByBedroom(p: CatalogueProject): PriceRow[] {
  const rows = new Map<number, PriceRow>();
  const lo = (a: number | null, b: number | null | undefined) => (b == null ? a : a == null ? b : Math.min(a, b));
  const hi = (a: number | null, b: number | null | undefined) => (b == null ? a : a == null ? b : Math.max(a, b));
  for (const t of p.unitTypes) {
    if (t.unitsLeft === 0) continue;
    const r = rows.get(t.bedrooms) ?? { bedrooms: t.bedrooms, loPsf: null, hiPsf: null, loPrice: null, hiPrice: null, unitsLeft: null };
    r.loPrice = lo(r.loPrice, t.fromPrice);
    r.hiPrice = hi(r.hiPrice, t.toPrice);
    r.loPsf = lo(r.loPsf, t.psfRange?.min ?? t.fromPsf);
    r.hiPsf = hi(r.hiPsf, t.psfRange?.max ?? t.fromPsf);
    r.unitsLeft = t.unitsLeft === null ? r.unitsLeft : (r.unitsLeft ?? 0) + t.unitsLeft;
    rows.set(t.bedrooms, r);
  }
  return [...rows.values()].sort((a, b) => a.bedrooms - b.bedrooms);
}

export interface DistrictValue {
  avgPsf: number;
  /** Sales (URA) or available units (new launches) behind the average. */
  count: number;
}

/**
 * Average price per sq ft by postal district: URA's sales over the last 12
 * months when loaded, otherwise the available units at the new launches on
 * the map (weighted by units).
 */
export function districtPsf(
  projects: CatalogueProject[],
  market: { districts?: { district: string; sales: number; avgPsf: number }[] },
  districtOf: (p: CatalogueProject) => string | null,
): { basis: "ura" | "new-launch" | null; values: Map<string, DistrictValue> } {
  if (market.districts?.length) {
    return { basis: "ura", values: new Map(market.districts.map((d) => [d.district, { avgPsf: d.avgPsf, count: d.sales }])) };
  }
  const sums = new Map<string, { total: number; units: number }>();
  for (const p of projects) {
    const d = districtOf(p);
    if (!d) continue;
    for (const t of p.unitTypes) {
      if (!t.psfRange) continue;
      const s = sums.get(d) ?? { total: 0, units: 0 };
      s.total += t.psfRange.avg * t.psfRange.units;
      s.units += t.psfRange.units;
      sums.set(d, s);
    }
  }
  const values = new Map([...sums].filter(([, s]) => s.units > 0).map(([d, s]) => [d, { avgPsf: Math.round(s.total / s.units), count: s.units }]));
  return { basis: values.size ? "new-launch" : null, values };
}

/** Light yellow to deep red, as on property maps; checked for contrast against the district labels. */
export const PSF_COLOURS = ["#fdf3c6", "#fbe39b", "#f8c97b", "#f4a96a", "#ee8360", "#e05650", "#c13a4a"];

/** Equal-width price bands between the lowest and highest district average. */
export function psfBands(values: number[], colours = PSF_COLOURS): { from: number; to: number; colour: string }[] {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ from: min, to: max, colour: colours[Math.floor(colours.length / 2)] }];
  const step = (max - min) / colours.length;
  return colours.map((colour, i) => ({ from: Math.round(min + step * i) + (i ? 1 : 0), to: Math.round(min + step * (i + 1)), colour }));
}

export function bandColour(v: number, bands: { from: number; to: number; colour: string }[]): string | null {
  return bands.find((b) => v <= b.to)?.colour ?? bands[bands.length - 1]?.colour ?? null;
}

export interface Cluster<T> {
  items: T[];
  x: number;
  y: number;
}

/** Groups points on a square grid (in the same units as x and y), so nearby markers show as one bubble with a count. */
export function cluster<T extends { x: number; y: number }>(points: T[], cell: number): Cluster<T>[] {
  const cells = new Map<string, T[]>();
  for (const p of points) {
    const k = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`;
    cells.set(k, [...(cells.get(k) ?? []), p]);
  }
  return [...cells.values()].map((items) => ({
    items,
    x: items.reduce((a, p) => a + p.x, 0) / items.length,
    y: items.reduce((a, p) => a + p.y, 0) / items.length,
  }));
}

/** Parses the map's SVG paths ("M x yL x y…Z…") into rings. */
export function pathRings(d: string): [number, number][][] {
  return d
    .split("M")
    .filter(Boolean)
    .map((ring) =>
      ring
        .replace(/Z/g, "")
        .split("L")
        .map((pt) => pt.trim().split(/\s+/).map(Number) as [number, number]),
    );
}

export function insideRings(x: number, y: number, rings: [number, number][][]): boolean {
  let c = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[j];
      if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) c = !c;
    }
  }
  return c;
}

export type Region = "CCR" | "RCR" | "OCR";

export interface LabelCandidate {
  key: string;
  text: string;
  /** Position on screen, pixels (the label's centre). */
  sx: number;
  sy: number;
  fontPx: number;
  /** Lower goes first. */
  priority: number;
}

/**
 * Chooses labels that don't overlap each other or the screen edge, highest
 * priority first (a greedy pass, as map renderers do). Text width is
 * estimated from the font size.
 */
export function placeLabels(
  candidates: LabelCandidate[],
  width: number,
  height: number,
  pad = 4,
  /** Areas labels must avoid (markers, floating panels), in screen pixels. */
  obstacles: { x0: number; y0: number; x1: number; y1: number }[] = [],
): Set<string> {
  const placed = [...obstacles];
  const keep = new Set<string>();
  for (const c of [...candidates].sort((a, b) => a.priority - b.priority)) {
    const w = c.text.length * c.fontPx * 0.58 + pad * 2;
    const h = c.fontPx * 1.25 + pad;
    const box = { x0: c.sx - w / 2, y0: c.sy - h / 2, x1: c.sx + w / 2, y1: c.sy + h / 2 };
    if (box.x0 < 0 || box.y0 < 0 || box.x1 > width || box.y1 > height) continue;
    if (placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0)) continue;
    placed.push(box);
    keep.add(c.key);
  }
  return keep;
}
