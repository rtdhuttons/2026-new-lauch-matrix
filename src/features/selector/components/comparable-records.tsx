"use client";

// A comparable project's sales and rents from URA: prices by year and by
// floor, rents by bedrooms, and what first buyers paid where Huttons lists it.
// Only arithmetic on the records; nothing here forecasts this project.

import type { UraComparable } from "../model/project";
import { BarChart, ChartCard, LineChart, SERIES } from "./charts";
import { Disclosure } from "./ui";

const psf = (n: number) => `S$${Math.round(n).toLocaleString("en-SG")}`;
const money = (n: number) => `S$${Math.round(n).toLocaleString("en-SG")}`;
const rentPsf = (n: number) => `S$${n.toFixed(2)}`;
const SALE: Record<string, string> = { new: "New sale", sub: "Sub-sale", resale: "Resale", other: "Other" };
const monthText = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-SG", { month: "short", year: "numeric" });

/** Change from what first buyers paid to recent resales, as a whole-number percentage. */
export function changeSinceLaunch(r: UraComparable): number | null {
  if (!r.firstSale || !r.resaleLast12.medianPsf || r.resaleLast12.count < 3) return null;
  return Math.round((r.resaleLast12.medianPsf / r.firstSale.medianPsf - 1) * 100);
}

/** Indicative gross yield: a year's median rent per sq ft over the median resale price per sq ft. */
export function grossYield(r: UraComparable): number | null {
  const rents = r.rentTrend.slice(-4);
  if (!rents.length || !r.resaleLast12.medianPsf || r.resaleLast12.count < 3) return null;
  const monthly = rents.reduce((a, q) => a + q.medianPsf * q.count, 0) / rents.reduce((a, q) => a + q.count, 0);
  return (monthly * 12) / r.resaleLast12.medianPsf;
}

export function ComparableRecords({ record, fetched, salesWindow }: { record: UraComparable; fetched: string; salesWindow: string }) {
  const change = changeSinceLaunch(record);
  const yld = grossYield(record);
  const totals = record.salesByYear.reduce((a, y) => ({ new: a.new + y.new, sub: a.sub + y.sub, resale: a.resale + y.resale }), { new: 0, sub: 0, resale: 0 });
  const lastRent = record.rentTrend[record.rentTrend.length - 1];
  const tiles: { label: string; value: string; note: string }[] = [
    {
      label: "Resale price, last 12 months",
      value: record.resaleLast12.medianPsf ? `${psf(record.resaleLast12.medianPsf)} psf` : "No resales",
      note: record.resaleLast12.count ? `Median of ${record.resaleLast12.count} resale${record.resaleLast12.count > 1 ? "s" : ""}` : "None recorded in the last 12 months",
    },
    ...(record.firstSale
      ? [{
          label: "First buyers paid",
          value: `${psf(record.firstSale.medianPsf)} psf`,
          note: `Median of ${record.firstSale.count.toLocaleString("en-SG")} developer sales, ${monthText(record.firstSale.from)} to ${monthText(record.firstSale.to)}`,
        }]
      : []),
    ...(change !== null ? [{ label: "Change since launch", value: `${change > 0 ? "+" : ""}${change}%`, note: "Recent resale median against first buyers' median, per sq ft" }] : []),
    ...(lastRent ? [{ label: "Rent a month", value: `${rentPsf(lastRent.medianPsf)} psf`, note: `Median of ${lastRent.count} contracts, ${lastRent.quarter}` }] : []),
    ...(yld !== null ? [{ label: "Indicative gross yield", value: `${(yld * 100).toFixed(1)}%`, note: "A year's median rent over the median resale price, per sq ft" }] : []),
  ];
  const years = record.salesByYear;
  const series = [
    { id: "resale", label: "Resales", color: SERIES[0], points: years.filter((y) => y.resalePsf).map((y) => ({ x: y.year, y: y.resalePsf! })) },
    { id: "sub", label: "Sub-sales", color: SERIES[1], points: years.filter((y) => y.subPsf).map((y) => ({ x: y.year, y: y.subPsf! })) },
    { id: "new", label: "New sales", color: SERIES[2], points: years.filter((y) => y.newPsf).map((y) => ({ x: y.year, y: y.newPsf! })), dashed: true },
  ].filter((s) => s.points.length > 0);

  return (
    <div className="grid gap-4 [&>*]:min-w-0">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-canopy/10 bg-mist/60 p-4">
            <dt className="font-display-normal text-xs font-semibold uppercase tracking-[0.06em] text-canopy/65">{t.label}</dt>
            <dd className="mt-1 font-display text-2xl font-extrabold tabular-nums">{t.value}</dd>
            <dd className="mt-0.5 text-xs text-canopy/70">{t.note}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        {series.length > 0 && (
          <ChartCard
            title="Price per sq ft by year"
            subtitle={`Median of each kind of sale. ${totals.resale.toLocaleString("en-SG")} resales, ${totals.sub.toLocaleString("en-SG")} sub-sales and ${totals.new.toLocaleString("en-SG")} new sales, ${salesWindow}.`}
            legend={series.map((s) => ({ label: s.label, color: s.color, shape: s.dashed ? ("dashed" as const) : ("line" as const) }))}
            table={{
              caption: `${record.name}: sales and median price per sq ft by year`,
              columns: ["Year", "Resales", "Median psf", "Sub-sales", "Median psf", "New sales", "Median psf"],
              rows: years.map((y) => [y.year, y.resale, y.resalePsf ? psf(y.resalePsf) : "—", y.sub, y.subPsf ? psf(y.subPsf) : "—", y.new, y.newPsf ? psf(y.newPsf) : "—"]),
            }}
          >
            <LineChart ariaLabel={`${record.name}: median price per sq ft by year`} series={series} xFormat={(n) => String(n)} yFormat={psf} xTicks={years.map((y) => y.year)} />
          </ChartCard>
        )}
        {record.resaleByFloor.length > 1 ? (
          <ChartCard
            title="Resale price per sq ft by floor"
            subtitle="Median over the five years, by URA's floor range. Sizes and dates differ, so read the pattern rather than the exact gaps."
            table={{
              caption: `${record.name}: resales by floor range`,
              columns: ["Floors", "Resales", "Median psf"],
              rows: record.resaleByFloor.map((f) => [f.floors, f.count, psf(f.medianPsf)]),
            }}
          >
            <BarChart
              ariaLabel={`${record.name}: median resale price per sq ft by floor range`}
              format={psf}
              bars={record.resaleByFloor.map((f) => ({ id: f.floors, label: `Floors ${f.floors.replace(/^0/, "").replace(/-0/, "–").replace("-", "–")}`, sub: `${f.count} resale${f.count > 1 ? "s" : ""}`, value: f.medianPsf }))}
            />
          </ChartCard>
        ) : (
          record.rentsByBedroom.length > 0 && (
            <ChartCard title="Median monthly rent by bedrooms" subtitle={record.rentPeriod}>
              <BarChart
                ariaLabel={`${record.name}: median monthly rent by bedrooms`}
                format={money}
                bars={record.rentsByBedroom.filter((b) => b.bedrooms !== null).map((b) => ({ id: String(b.bedrooms), label: `${b.bedrooms} bedroom${b.bedrooms! > 1 ? "s" : ""}`, sub: `${b.count} contracts`, value: b.medianRent }))}
              />
            </ChartCard>
          )
        )}
      </div>

      {record.rentsByBedroom.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-canopy/10">
          <table className="w-full border-collapse bg-paper font-display-normal text-sm tabular-nums">
            <caption className="px-4 pt-3 text-left font-semibold">Rents, {record.rentPeriod}</caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.06em] text-canopy/65">
                <th scope="col" className="px-4 py-2 font-semibold">Bedrooms</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Contracts</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Median rent a month</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Per sq ft</th>
              </tr>
            </thead>
            <tbody>
              {record.rentsByBedroom.map((b) => (
                <tr key={String(b.bedrooms)} className="border-t border-canopy/10">
                  <th scope="row" className="px-4 py-2 text-left font-normal">{b.bedrooms === null ? "Not stated" : b.bedrooms}</th>
                  <td className="px-4 py-2 text-right">{b.count}</td>
                  <td className="px-4 py-2 text-right font-semibold">{money(b.medianRent)}</td>
                  <td className="px-4 py-2 text-right">{b.medianPsf !== null ? rentPsf(b.medianPsf) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {record.recentSales.length > 0 && (
        <Disclosure title={`Latest ${record.recentSales.length} sales at ${record.name}`} hint="Month, kind of sale, floor range, size and price">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-display-normal text-sm tabular-nums">
              <caption className="sr-only">Latest sales at {record.name}</caption>
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.06em] text-canopy/65">
                  <th scope="col" className="py-2 pr-3 font-semibold">Month</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Sale</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Floors</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Size (sq ft)</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Price</th>
                  <th scope="col" className="py-2 text-right font-semibold">Per sq ft</th>
                </tr>
              </thead>
              <tbody>
                {record.recentSales.map((s, i) => (
                  <tr key={i} className="border-t border-canopy/10">
                    <td className="py-2 pr-3">{monthText(s[0])}</td>
                    <td className="py-2 pr-3">{SALE[s[1]]}</td>
                    <td className="py-2 pr-3">{s[2] ?? "—"}</td>
                    <td className="py-2 pr-3 text-right">{s[3].toLocaleString("en-SG")}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{money(s[4])}</td>
                    <td className="py-2 text-right">{psf(s[4] / s[3])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Disclosure>
      )}

      <p className="text-xs text-stone">
        Sales: URA caveats lodged, {salesWindow} ({record.ura.project}, {record.ura.street.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}); a sub-sale is a resale before
        completion. Rents: URA rental contracts; rent per sq ft uses the middle of URA&apos;s size band.
        {record.firstSale ? ` First buyers: the developer's recorded sales in the ${record.firstSale.source}.` : ""} URA doesn&apos;t link a resale to the unit&apos;s
        earlier purchase, so these figures show price levels, not each owner&apos;s profit. Checked {fetched}.
      </p>
    </div>
  );
}
