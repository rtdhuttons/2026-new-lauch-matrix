"use client";

// Rental Potential: recorded leases at a comparison project, by bedrooms and
// by size, and an indicative gross yield on the selected home. Net income
// needs costs that are not supplied yet, so it is shown as missing rather
// than guessed.

import { useState } from "react";
import type { RentalEvidence as Evidence } from "../model/project";
import type { Unit } from "../model/types";
import { unitLabel } from "../lib/dataset-index";
import type { Engine } from "../lib/engine";
import { money } from "../lib/format";
import type { RentSummary } from "../lib/rentals";
import { estimateRent, MIN_LEASES_FOR_BEDROOM_PSF, recentRecords, rentsByBedrooms, rentsBySize, rentsForSize, summariseRents } from "../lib/rentals";
import { NotSupplied } from "./tabs";
import { BarChart, ChartCard, fmtMoney } from "./charts";
import { card, Disclosure } from "./ui";
import { AmountInput } from "./amount-input";

const monthText = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-SG", { month: "short", year: "numeric", timeZone: "UTC" });

function RentTable({ caption, rows }: { caption: string; rows: RentSummary[] }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse font-display-normal text-sm tabular-nums">
        <caption className="px-4 pb-2 pt-4 text-left font-display-normal text-base font-semibold">{caption}</caption>
        <thead>
          <tr className="bg-mist text-left text-xs uppercase tracking-[0.06em] text-canopy/70">
            <th scope="col" className="px-4 py-2.5 font-semibold" />
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Leases</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Median rent</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Middle half</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Lowest–highest</th>
            <th scope="col" className="px-4 py-2.5 text-right font-semibold">Per sq ft</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-canopy/10">
              <th scope="row" className="px-4 py-2.5 text-left font-semibold">{r.label}</th>
              <td className="px-3 py-2.5 text-right">{r.leases}</td>
              <td className="px-3 py-2.5 text-right font-semibold">{money(r.median)}</td>
              <td className="px-3 py-2.5 text-right">{money(r.q1)}–{money(r.q3)}</td>
              <td className="px-3 py-2.5 text-right">{money(r.low)}–{money(r.high)}</td>
              <td className="px-4 py-2.5 text-right">${r.medianPsf.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The size band (by label) a unit of this size falls in, if any. */
function sizeLabelFor(rows: RentSummary[], area: number | null): string | null {
  if (area === null) return null;
  for (const r of rows) {
    const m = r.label.match(/([\d,]+)\D+([\d,]+)/);
    if (m && area >= Number(m[1].replace(/,/g, "")) && area < Number(m[2].replace(/,/g, ""))) return r.label;
  }
  return null;
}

export function RentalPotential({ evidence, engine, unit }: { evidence: Evidence[]; engine: Engine; unit: Unit | null }) {
  const [period, setPeriod] = useState<"all" | "12">("12");
  const [rentInput, setRentInput] = useState<string>("");

  if (evidence.length === 0) {
    return (
      <NotSupplied
        title="Rental evidence has not been added for this project."
        needed={["Rental contracts for this project or a comparable one: lease month, size, monthly rent and bedrooms where recorded."]}
      />
    );
  }

  const ev = evidence[0];
  const records = period === "12" ? recentRecords(ev.records, 12) : ev.records;
  const all = summariseRents("All", records);
  const months = records.map((r) => r.month).sort();
  const layout = unit ? engine.ix.unitLayout(unit) : null;
  const sizeMatch = layout?.areaSqft ? rentsForSize(records, layout.areaSqft) : [];
  const sizeSummary = layout?.areaSqft ? summariseRents("Same size band", sizeMatch) : null;
  // A comparable's rents: rent per sq ft (last 12 months) times this unit's size.
  const last12 = recentRecords(ev.records, 12);
  const psfEstimate = ev.estimateFromPsf && layout?.areaSqft ? estimateRent(last12, layout.areaSqft, layout.bedrooms) : null;
  const startRent = psfEstimate?.rent ?? (sizeSummary ? Math.round(sizeSummary.median) : null);
  const rent = rentInput !== "" ? Number(rentInput) : startRent;
  const yieldPct = rent && unit?.price ? ((rent * 12) / unit.price) * 100 : null;

  return (
    <div className="grid grid-cols-1 gap-5 [&>*]:min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[70ch] text-[1rem] text-canopy/80">
          {records.length.toLocaleString("en-SG")} leases at {ev.project}
          {months.length > 0 && <>, signed {monthText(months[0])} to {monthText(months[months.length - 1])}</>}. A guide to rents for similar homes nearby, not
          a rent for this project.
        </p>
        <div role="group" aria-label="Lease period" className="flex rounded-full border border-canopy/10 bg-paper p-1">
          {([
            ["12", "Last 12 months"],
            ["all", "All years"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={period === id}
              onClick={() => setPeriod(id)}
              className={`rounded-full px-3.5 py-1.5 font-display-normal text-sm font-semibold ${period === id ? "bg-canopy text-mist" : "text-canopy/75"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 [&>*]:min-w-0">
        {[
          { title: "Monthly rent by bedrooms", rows: rentsByBedrooms(records) },
          { title: "Monthly rent by size", rows: rentsBySize(records) },
        ].map((c) => (
          <ChartCard key={c.title} title={c.title} subtitle="Median rent; the whisker spans the middle half of leases">
            <BarChart
              ariaLabel={`${c.title} at ${ev.project}`}
              format={fmtMoney}
              rangeLabel="middle half of leases"
              bars={c.rows.map((r) => ({
                id: r.label,
                label: r.label,
                sub: `${r.leases} leases`,
                value: r.median,
                range: [r.q1, r.q3] as [number, number],
                color: "#0b7f9e",
                emphasis: !!sizeSummary && r.label === sizeLabelFor(c.rows, layout?.areaSqft ?? null),
              }))}
            />
          </ChartCard>
        ))}
      </div>

      <Disclosure title="View rent tables" hint="Leases, median, middle half, lowest to highest, and rent per sq ft">
      <div className={`${card} overflow-hidden p-0`}>
        <RentTable caption="By bedrooms (as recorded)" rows={rentsByBedrooms(records)} />
        <div className="border-t border-canopy/10" />
        <RentTable caption="By size" rows={rentsBySize(records)} />
        <p className="border-t border-canopy/10 px-4 py-3 text-xs text-stone">
          Source: {ev.provenance.source}, as at {ev.provenance.updated}. {ev.provenance.note}
          {all ? ` Overall median ${money(all.median)} a month.` : ""}
        </p>
      </div>
      </Disclosure>

      <div className={`${card} p-5 sm:p-6`}>
        <h3 className="font-display text-lg font-extrabold">Indicative gross yield</h3>
        {!unit || !layout?.areaSqft ? (
          <p className="mt-2 text-canopy/80">Choose a unit to see the leases for units of its size.</p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="font-display-normal text-sm text-canopy/70">Selected unit</p>
              <p className="font-display-normal font-semibold">{unitLabel(engine.ix, unit)}</p>
              <p className="text-sm text-canopy/75">
                {layout.areaSqft.toLocaleString("en-SG")} sq ft · {unit.price !== null ? `${money(unit.price)}${unit.priceIsEstimate ? " (estimate)" : ""}` : "price not published"}
              </p>
            </div>
            <div>
              <label htmlFor="rent-input" className="font-display-normal text-sm text-canopy/70">
                Monthly rent
              </label>
              <div className="mt-1 flex items-center gap-1">
                <span className="text-canopy/70">$</span>
                <AmountInput
                  id="rent-input"
                  value={rentInput !== "" ? Number(rentInput) : startRent}
                  onChange={(v) => setRentInput(v === null ? "" : String(v))}
                  className="w-32 rounded-lg border border-canopy/20 bg-paper px-3 py-1.5 font-display-normal"
                />
              </div>
              <p className="mt-1 text-xs text-stone">
                {psfEstimate
                  ? `Estimate: $${psfEstimate.psf.toFixed(2)} psf (median of ${psfEstimate.leases} ${psfEstimate.basis === "bedrooms" ? `${layout.bedrooms}-bedroom ` : ""}leases at ${ev.project} in the last 12 months) × ${layout.areaSqft.toLocaleString("en-SG")} sq ft. Type a rent to test your own.`
                  : sizeSummary
                    ? `Starts at the median of ${sizeSummary.leases} leases in the same size band.`
                    : "No leases in this size band; type a rent to test."}
              </p>
            </div>
            <div>
              <p className="font-display-normal text-sm text-canopy/70">Gross yield</p>
              <p className="font-display text-2xl font-extrabold">{yieldPct !== null ? `${yieldPct.toFixed(2)}%` : "—"}</p>
              <p className="text-xs text-stone">
                12 months&apos; rent ÷ price{unit.priceIsEstimate ? ", on an illustrative price" : ""}. Before vacancy, costs and financing.
              </p>
            </div>
          </div>
        )}
      </div>

      {ev.estimateFromPsf && <RentByType evidence={ev} engine={engine} />}

      <NotSupplied title="Net rental income and cash flow after the loan can't be estimated yet." needed={[
        "Maintenance fee estimates from the developer.",
        "Property tax on let homes for the relevant year (IRAS rates), agent fees, repairs and insurance assumptions.",
        "Vacancy assumption you want to use.",
        "Financing assumptions (loan, rate, tenure), shared with the payment planner.",
      ]}>
        Gross yield above is rent against price only. Net income and cash flow need the costs below, which haven&apos;t been supplied, so they
        are not estimated.
      </NotSupplied>
    </div>
  );
}

/** Every unit type's indicative rent: the comparable's rent per sq ft times the type's size. */
function RentByType({ evidence, engine }: { evidence: Evidence; engine: Engine }) {
  const last12 = recentRecords(evidence.records, 12);
  const types = new Map<string, { type: string; bedrooms: number | null; sqft: number; from: number | null; estimate: boolean; units: number }>();
  for (const u of engine.ix.ds.units) {
    const l = engine.ix.unitLayout(u);
    if (!l.areaSqft) continue;
    const key = `${l.category ?? l.name}|${l.areaSqft}`;
    const t = types.get(key) ?? { type: l.category ?? l.name, bedrooms: l.bedrooms, sqft: l.areaSqft, from: null, estimate: false, units: 0 };
    t.units += 1;
    if (u.price !== null && (t.from === null || u.price < t.from)) {
      t.from = u.price;
      t.estimate = !!u.priceIsEstimate;
    }
    types.set(key, t);
  }
  const rows = [...types.values()]
    .map((t) => ({ ...t, est: estimateRent(last12, t.sqft, t.bedrooms) }))
    .filter((t) => t.est)
    .sort((a, b) => (a.bedrooms ?? 0) - (b.bedrooms ?? 0) || a.sqft - b.sqft);
  if (rows.length === 0) return null;
  const anyEstimatePrice = rows.some((r) => r.estimate);
  // Sizes actually leased at the comparable; outside them the rate per sq ft is stretched.
  const smallest = Math.min(...last12.map((r) => r.areaSqft.min));
  const largest = Math.max(...last12.map((r) => r.areaSqft.max));
  const outside = (sqft: number) => sqft < smallest || sqft > largest;
  const anyOutside = rows.some((r) => outside(r.sqft));
  return (
    <section className={`${card} p-5 sm:p-6`} aria-labelledby="rent-by-type">
      <h3 id="rent-by-type" className="font-display text-lg font-extrabold">Estimated rent by unit type</h3>
      <p className="mt-1 max-w-[72ch] text-[0.9375rem] text-canopy/80">
        {evidence.project}&apos;s median rent per sq ft over the last 12 months, times each unit type&apos;s size. Where there are at least{" "}
        {MIN_LEASES_FOR_BEDROOM_PSF} leases with the same number of bedrooms, their rate is used; otherwise all leases. An assumption for planning, not a
        rent anyone has agreed.
      </p>
      <div className="mt-4">
        <ChartCard title="Estimated monthly rent" subtitle="By unit type and size">
          <BarChart
            ariaLabel={`Estimated monthly rent by unit type, from ${evidence.project}'s rent per sq ft`}
            format={fmtMoney}
            bars={rows.map((r) => ({ id: `${r.type}|${r.sqft}`, label: r.type, sub: `${r.sqft.toLocaleString("en-SG")} sq ft`, value: r.est!.rent, color: "#0b7f9e" }))}
          />
        </ChartCard>
      </div>
      <div className="relative mt-4 overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse font-display-normal text-sm tabular-nums">
          <caption className="sr-only">Estimated rent and gross yield by unit type</caption>
          <thead>
            <tr className="bg-mist text-left text-xs uppercase tracking-[0.06em] text-canopy/70">
              <th scope="col" className="px-4 py-2.5 font-semibold">Unit type</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Size (sq ft)</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Rent psf used</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Estimated rent</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Lowest price</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">Gross yield</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.type}|${r.sqft}`} className="border-t border-canopy/10">
                <th scope="row" className="px-4 py-2.5 text-left font-semibold">
                  {r.type}
                  {r.bedrooms !== null && <span className="ml-1 font-normal text-canopy/65">· {r.bedrooms} bed</span>}
                </th>
                <td className="px-3 py-2.5 text-right">
                  {r.sqft.toLocaleString("en-SG")}
                  {outside(r.sqft) && <span className="block text-xs font-semibold text-[#9b3b1c]">{r.sqft > largest ? "Larger" : "Smaller"} than leased</span>}
                </td>
                <td className="px-3 py-2.5 text-right">
                  ${r.est!.psf.toFixed(2)}
                  <span className="block text-xs text-canopy/60">{r.est!.basis === "bedrooms" ? `${r.est!.leases} ${r.bedrooms}-bed leases` : `all ${r.est!.leases} leases`}</span>
                </td>
                <td className="px-3 py-2.5 text-right font-semibold">{money(r.est!.rent)}</td>
                <td className="px-3 py-2.5 text-right">{r.from !== null ? `${money(r.from)}${r.estimate ? " (est.)" : ""}` : "—"}</td>
                <td className="px-4 py-2.5 text-right">{r.from !== null ? `${(((r.est!.rent * 12) / r.from) * 100).toFixed(2)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {anyOutside && (
        <p className="mt-3 rounded-lg border-l-4 border-[#c88a12] bg-[#fbf5e8] px-3 py-2 text-sm">
          In the last 12 months {evidence.project} leased units of {smallest.toLocaleString("en-SG")}–{largest.toLocaleString("en-SG")} sq ft. Rent per sq ft
          usually falls as units get bigger, so estimates for larger types are likely on the high side, and for smaller types on the low side.
        </p>
      )}
      <p className="mt-3 text-xs text-stone">
        Rents: {evidence.provenance.source}, as at {evidence.provenance.updated}; {last12.length} leases in the last 12 months of records. Gross yield is 12
        months&apos; estimated rent ÷ the lowest price of the type{anyEstimatePrice ? " (illustrative where marked est.)" : ""}, before vacancy, costs and
        financing.
      </p>
    </section>
  );
}
