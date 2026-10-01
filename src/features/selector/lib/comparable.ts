// Floor-band evidence from a comparable development.
//
// Resales are grouped into low (levels 1–10), mid (11–20) and high (21 and
// up) floors. For each band: number of resales, average and median gross
// profit, average profit per sq ft and average annualised return. Where a
// record has no purchase price, its psf gain is its profit divided by its
// size.

import type { ComparableProject, ComparableTransaction } from "../model/types";

export type FloorBand = "low" | "mid" | "high";

export const FLOOR_BANDS: { id: FloorBand; label: string; from: number; to: number }[] = [
  { id: "low", label: "Low", from: 1, to: 10 },
  { id: "mid", label: "Mid", from: 11, to: 20 },
  { id: "high", label: "High", from: 21, to: Infinity },
];

export function floorBand(level: number): FloorBand {
  return FLOOR_BANDS.find((b) => level >= b.from && level <= b.to)?.id ?? "high";
}

export interface BandStats {
  band: FloorBand;
  label: string;
  /** e.g. "#01–#10"; the top band ends at the highest floor sold. */
  floors: string;
  homes: number;
  avgProfit: number;
  medianProfit: number;
  psfGain: number;
  annualised: number;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const psfOf = (t: ComparableTransaction) => t.profitPsf ?? t.profit / t.areaSqft;
const pad = (n: number) => `#${String(n).padStart(2, "0")}`;

export function bandStats(txs: ComparableTransaction[]): BandStats[] {
  const top = Math.max(...txs.map((t) => t.floor));
  return FLOOR_BANDS.flatMap((b) => {
    const inBand = txs.filter((t) => t.floor >= b.from && t.floor <= b.to);
    if (inBand.length === 0) return [];
    return [
      {
        band: b.id,
        label: b.label,
        floors: `${pad(b.from)}–${pad(Math.min(b.to, top))}`,
        homes: inBand.length,
        avgProfit: mean(inBand.map((t) => t.profit)),
        medianProfit: median(inBand.map((t) => t.profit)),
        psfGain: mean(inBand.map(psfOf)),
        annualised: mean(inBand.map((t) => t.annualised)),
      },
    ];
  });
}

/** Same bedroom count, high floors against low floors. */
export interface LikeForLike {
  bedrooms: number;
  high: { homes: number; avgProfit: number; annualised: number };
  low: { homes: number; avgProfit: number; annualised: number };
}

export function likeForLike(txs: ComparableTransaction[], bedrooms: number): LikeForLike | null {
  const pick = (band: FloorBand) => txs.filter((t) => t.bedrooms === bedrooms && floorBand(t.floor) === band);
  const hi = pick("high");
  const lo = pick("low");
  if (hi.length < 3 || lo.length < 3) return null;
  const sum = (xs: ComparableTransaction[]) => ({
    homes: xs.length,
    avgProfit: mean(xs.map((t) => t.profit)),
    annualised: mean(xs.map((t) => t.annualised)),
  });
  return { bedrooms, high: sum(hi), low: sum(lo) };
}

/** Least-squares line of profit against floor: profit ≈ intercept + slope × floor. */
export function profitTrend(txs: ComparableTransaction[]): { slope: number; intercept: number } {
  const xs = txs.map((t) => t.floor);
  const ys = txs.map((t) => t.profit);
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: my - slope * mx };
}

/** Most exit-appeal points a floor band can add. */
export const FLOOR_BAND_MAX_POINTS = 30;

/**
 * Exit-appeal points for a floor band, from the comparable's annualised
 * returns: 0 for the weakest band, 30 for the strongest, in proportion
 * between. Null when there is no comparable.
 */
export function floorBandPoints(project: ComparableProject | undefined, level: number): { points: number; band: BandStats } | null {
  if (!project || project.transactions.length === 0) return null;
  const stats = bandStats(project.transactions);
  const band = stats.find((b) => b.band === floorBand(level));
  if (!band) return null;
  const lo = Math.min(...stats.map((b) => b.annualised));
  const hi = Math.max(...stats.map((b) => b.annualised));
  const points = hi === lo ? 0 : Math.round(((band.annualised - lo) / (hi - lo)) * FLOOR_BAND_MAX_POINTS);
  return { points, band };
}
