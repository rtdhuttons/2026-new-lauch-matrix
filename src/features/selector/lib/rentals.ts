// Rental evidence: counts, medians and ranges from recorded leases.
// Records without a bedroom count are kept and reported as "not recorded",
// never assigned a bedroom type.

import type { RentalRecord } from "../model/project";
import { median } from "./comparable";

export interface RentSummary {
  label: string;
  leases: number;
  median: number;
  low: number;
  high: number;
  /** 25th and 75th percentiles, the middle half of rents. */
  q1: number;
  q3: number;
  /** Median rent per sq ft a month, using the middle of each size band. */
  medianPsf: number;
  latest: string;
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function summariseRents(label: string, records: RentalRecord[]): RentSummary | null {
  if (records.length === 0) return null;
  const rents = records.map((r) => r.monthlyRent).sort((a, b) => a - b);
  return {
    label,
    leases: records.length,
    median: median(rents),
    low: rents[0],
    high: rents[rents.length - 1],
    q1: quantile(rents, 0.25),
    q3: quantile(rents, 0.75),
    medianPsf: median(records.map((r) => r.monthlyRent / ((r.areaSqft.min + r.areaSqft.max) / 2))),
    latest: records.map((r) => r.month).sort().at(-1)!,
  };
}

/** Leases signed in the `months` months up to and including the latest record. */
export function recentRecords(records: RentalRecord[], months: number): RentalRecord[] {
  if (records.length === 0) return [];
  const latest = records.map((r) => r.month).sort().at(-1)!;
  const d = new Date(`${latest}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - (months - 1));
  const from = d.toISOString().slice(0, 10);
  return records.filter((r) => r.month >= from);
}

export function rentsByBedrooms(records: RentalRecord[]): RentSummary[] {
  const beds = [...new Set(records.map((r) => r.bedrooms).filter((b): b is number => b !== null))].sort((a, b) => a - b);
  const out = beds.flatMap((b) => summariseRents(`${b}-bedroom`, records.filter((r) => r.bedrooms === b)) ?? []);
  const unknown = summariseRents("Bedrooms not recorded", records.filter((r) => r.bedrooms === null));
  return unknown ? [...out, unknown] : out;
}

export function rentsBySize(records: RentalRecord[]): RentSummary[] {
  const bands = [...new Set(records.map((r) => `${r.areaSqft.min}-${r.areaSqft.max}`))]
    .map((k) => k.split("-").map(Number) as [number, number])
    .sort((a, b) => a[0] - b[0]);
  return bands.flatMap(([min, max]) =>
    summariseRents(
      `${min.toLocaleString("en-SG")}–${max.toLocaleString("en-SG")} sq ft`,
      records.filter((r) => r.areaSqft.min === min && r.areaSqft.max === max),
    ) ?? [],
  );
}

/** Leases whose size band contains `sqft`. */
export function rentsForSize(records: RentalRecord[], sqft: number): RentalRecord[] {
  return records.filter((r) => sqft >= r.areaSqft.min && sqft < r.areaSqft.max);
}
