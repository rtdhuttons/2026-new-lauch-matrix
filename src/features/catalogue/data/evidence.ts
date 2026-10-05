// Developments with transaction reports already in the repo, shown on the
// projects map beside URA's figures. JadeScape: 321 matched purchases and
// resales (Huttons report, 22 Sep 2026) and 881 rental contracts (3 Oct 2026).

import { jadescape } from "@/features/selector/data/comparables/jadescape";
import { jadescapeRentals } from "@/features/selector/data/comparables/jadescape-rentals";
import type { MarketProject, MarketRent, MarketSale, MarketYear } from "../model";

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function jadescapeMarket(): MarketProject {
  const tx = jadescape.transactions;
  const years = new Map<number, number[]>();
  for (const t of tx) {
    const y = Number(t.saleDate.slice(0, 4));
    years.set(y, [...(years.get(y) ?? []), t.salePrice / t.areaSqft]);
  }
  const sales: MarketYear[] = [...years.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, psf]) => ({ year, count: psf.length, medianPsf: Math.round(median(psf)), newSale: 0, subSale: 0, resale: psf.length }));
  const latest = tx.reduce((m, t) => (t.saleDate > m ? t.saleDate : m), "");
  const cutoff = `${Number(latest.slice(0, 4)) - 2}${latest.slice(4, 7)}`;
  const recentSales: MarketSale[] = tx
    .filter((t) => t.saleDate.slice(0, 7) > cutoff)
    .sort((a, b) => b.saleDate.localeCompare(a.saleDate))
    .slice(0, 40)
    .map((t) => [t.saleDate.slice(0, 7), "resale", `Level ${t.floor}`, t.areaSqft, t.salePrice, Math.round(t.salePrice / t.areaSqft)]);
  // Rents over the latest 12 months of contracts.
  const lastMonth = jadescapeRentals.records.reduce((m, r) => (r.month > m ? r.month : m), "");
  const from = `${Number(lastMonth.slice(0, 4)) - 1}${lastMonth.slice(4)}`;
  const recent = jadescapeRentals.records.filter((r) => r.month > from);
  const byBeds = new Map<number | null, typeof recent>();
  for (const r of recent) byBeds.set(r.bedrooms, [...(byBeds.get(r.bedrooms) ?? []), r]);
  const rentals: MarketRent[] = [...byBeds.entries()]
    .sort((a, b) => (a[0] ?? 99) - (b[0] ?? 99))
    .map(([bedrooms, rs]) => ({
      bedrooms,
      count: rs.length,
      medianRent: Math.round(median(rs.map((r) => r.monthlyRent))),
      medianPsf: Math.round(median(rs.map((r) => r.monthlyRent / ((r.areaSqft.min + r.areaSqft.max) / 2))) * 100) / 100,
    }));
  const mean = tx.reduce((s, t) => s + t.annualised, 0) / tx.length;
  return {
    name: "JadeScape",
    street: "Shunfu Road",
    // OneMap address point for JadeScape.
    lat: 1.351815,
    lon: 103.838298,
    segment: null,
    district: "20",
    tenure: null,
    propertyType: "Condominium",
    sales,
    recentSales,
    rentals,
    matchedCagr: { rate: mean, resales: tx.length, source: "Huttons JadeScape report, 22 Sep 2026" },
    source: `Resales: ${jadescape.provenance.source} (only units that were resold; ${lastMonth.slice(0, 7)} latest rent). Rents: ${jadescapeRentals.provenance.source}, 12 months to ${lastMonth.slice(0, 7)}.`,
  };
}

export const reportEvidence: MarketProject[] = [jadescapeMarket()];
