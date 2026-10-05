"use client";

import { useMemo, useState } from "react";
import type { Dataset } from "../model/types";
import type { PriceEstimate } from "../lib/estimate";
import { averagePsf, baseFromAverage, describeEstimate, estimatedPsf, lowestHomeLevel } from "../lib/estimate";
import { layoutLookup } from "../lib/dataset-index";
import { compactMoney } from "../lib/format";
import { PriceMatrix } from "./price-matrix";
import { BEDROOM_COLOURS, card, Segmented } from "./ui";

interface TypeRow {
  key: string;
  name: string;
  bedrooms: number | null;
  areaSqft: number;
  homes: number;
  levels: [number, number];
  price: [number, number];
  psf: [number, number];
}

/** One row per unit type and size: the price range from its lowest to highest home. */
function typeRows(ds: Dataset): TypeRow[] {
  const layoutOf = layoutLookup(ds);
  const rows = new Map<string, TypeRow>();
  for (const u of ds.units) {
    const l = layoutOf(u);
    if (!l || u.price === null || l.areaSqft === null) continue;
    const key = `${l.category ?? l.name}|${l.areaSqft}`;
    const psf = u.price / l.areaSqft;
    const r = rows.get(key);
    if (!r) {
      rows.set(key, {
        key,
        name: l.category ?? l.name,
        bedrooms: l.bedrooms,
        areaSqft: l.areaSqft,
        homes: 1,
        levels: [u.level, u.level],
        price: [u.price, u.price],
        psf: [psf, psf],
      });
      continue;
    }
    r.homes += 1;
    r.levels = [Math.min(r.levels[0], u.level), Math.max(r.levels[1], u.level)];
    r.price = [Math.min(r.price[0], u.price), Math.max(r.price[1], u.price)];
    r.psf = [Math.min(r.psf[0], psf), Math.max(r.psf[1], psf)];
  }
  return [...rows.values()].sort((a, b) => a.areaSqft - b.areaSqft);
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-SG")}`;

function NumberField({
  id,
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  // Keep what the user is typing; only commit numbers inside the range.
  const [text, setText] = useState(String(value));
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setText(String(value));
  }
  const n = Number(text);
  const invalid = text.trim() === "" || !Number.isFinite(n) || n < min || n > max;
  return (
    <div>
      <label htmlFor={id} className="font-display-normal text-sm font-semibold">
        {label}
      </label>
      <div className="mt-1 flex items-center rounded-md border border-canopy/20 bg-paper focus-within:border-canopy">
        <span className="pl-3 font-display-normal text-sm text-stone">$</span>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={text}
          aria-invalid={invalid}
          aria-describedby={`${id}-hint`}
          onChange={(e) => {
            setText(e.target.value);
            const v = Number(e.target.value);
            if (e.target.value.trim() !== "" && Number.isFinite(v) && v >= min && v <= max) {
              setShown(v);
              onChange(v);
            }
          }}
          onBlur={() => setText(String(value))}
          className="w-full bg-transparent px-1.5 py-2 font-display-normal text-base tabular-nums outline-none"
        />
        <span className="pr-3 font-display-normal text-sm text-stone">psf</span>
      </div>
      <p id={`${id}-hint`} className={`mt-1 text-sm ${invalid ? "text-[#9b2f28]" : "text-stone"}`}>
        {invalid ? `Enter ${money(min)} to ${money(max)}.` : hint}
      </p>
    </div>
  );
}

export function PriceEstimateSection({
  base,
  priced,
  enabled,
  onEnabled,
  estimate,
  onEstimate,
  defaults,
  bedrooms = "any",
}: {
  /** The project's own starting assumptions, restored by Reset. */
  defaults: PriceEstimate;
  /** Show only unit types with this many bedrooms. */
  bedrooms?: number | "any";
  /** The dataset without estimates, for the level range. */
  base: Dataset;
  /** The dataset with estimates applied (when enabled). */
  priced: Dataset;
  enabled: boolean;
  onEnabled: (on: boolean) => void;
  estimate: PriceEstimate;
  onEstimate: (e: PriceEstimate) => void;
}) {
  const baseLevel = lowestHomeLevel(base);
  const topLevel = Math.max(...base.blocks.map((b) => b.storeys));
  const rows = useMemo(
    () => (enabled ? typeRows(priced) : []).filter((r) => bedrooms === "any" || r.bedrooms === bedrooms),
    [enabled, priced, bedrooms],
  );
  const [view, setView] = useState<"table" | "chart">("table");
  const [hover, setHover] = useState<string | null>(null);

  const lo = rows.length ? Math.floor(Math.min(...rows.map((r) => r.price[0])) / 500_000) * 500_000 : 0;
  const hi = rows.length ? Math.ceil(Math.max(...rows.map((r) => r.price[1])) / 500_000) * 500_000 : 1;
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += 500_000) ticks.push(t);
  const pct = (n: number) => ((n - lo) / (hi - lo)) * 100;
  const bedroomsShown = [...new Set(rows.map((r) => r.bedrooms).filter((b): b is number => b !== null))].sort();
  const isDefault = estimate.basePsf === defaults.basePsf && estimate.stepPsf === defaults.stepPsf;
  // Prices can be anchored on the lowest floor or on the average across every home.
  const [mode, setMode] = useState<"lowest" | "average">("lowest");
  const [avgTarget, setAvgTarget] = useState(() => Math.round(averagePsf(base, estimate)));
  const avgNow = Math.round(averagePsf(base, estimate));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr] [&>*]:min-w-0">
      <div className={`${card} p-5 sm:p-6`}>
        <h3 className="font-display text-lg font-extrabold">Assumptions</h3>
        <label className="mt-3 flex items-start gap-2.5 font-display-normal text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabled(e.target.checked)}
            className="mt-0.5 size-4 accent-canopy"
          />
          Use illustrative prices across the selector
        </label>
        <div className={`mt-4 grid gap-4 ${enabled ? "" : "pointer-events-none opacity-50"}`} aria-disabled={!enabled}>
          <Segmented<"lowest" | "average">
            label="Set prices by"
            value={mode}
            options={[
              { value: "lowest", label: "Lowest floor PSF" },
              { value: "average", label: "Average PSF" },
            ]}
            onChange={(m) => {
              setMode(m);
              if (m === "average") setAvgTarget(avgNow);
            }}
          />
          {mode === "lowest" ? (
            <NumberField
              id="base-psf"
              label={`Lowest floor (level ${baseLevel})`}
              hint={`Averages ${money(avgNow)} psf across all ${base.units.length.toLocaleString("en-SG")} units.`}
              value={estimate.basePsf}
              min={500}
              max={10_000}
              step={10}
              onChange={(basePsf) => onEstimate({ ...estimate, basePsf })}
            />
          ) : (
            <NumberField
              id="avg-psf"
              label="Average across all units"
              hint={`Each unit counted at its own floor, so level ${baseLevel} is ${money(estimate.basePsf)} psf.`}
              value={avgTarget}
              min={500}
              max={10_000}
              step={10}
              onChange={(avg) => {
                setAvgTarget(avg);
                onEstimate({ ...estimate, basePsf: baseFromAverage(base, avg, estimate.stepPsf) });
              }}
            />
          )}
          <NumberField
            id="step-psf"
            label="Added per floor"
            hint={`So level ${topLevel} is ${money(estimatedPsf(topLevel, estimate, baseLevel))} psf.`}
            value={estimate.stepPsf}
            min={0}
            max={200}
            step={1}
            onChange={(stepPsf) =>
              onEstimate(
                mode === "average"
                  ? { stepPsf, basePsf: baseFromAverage(base, avgTarget, stepPsf) }
                  : { ...estimate, stepPsf },
              )
            }
          />
          <button
            type="button"
            disabled={isDefault && mode === "lowest"}
            onClick={() => {
              setMode("lowest");
              onEstimate(defaults);
            }}
            className="justify-self-start rounded-full border border-canopy/25 px-4 py-1.5 font-display-normal text-sm font-semibold disabled:opacity-40"
          >
            Reset to {money(defaults.basePsf)} + {money(defaults.stepPsf)}
          </button>
        </div>
        <p className="mt-5 rounded-lg bg-[#f4ead3] p-3 text-sm text-[#5c3f0b]">
          <strong className="font-semibold">Illustration only.</strong> Price = PSF × strata area, rounded to the nearest $1,000. These are your assumptions, not the developer&apos;s price list, and they say nothing about which units are available.
        </p>
      </div>

      <div className={`${card} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-extrabold">{view === "table" ? "Price by level" : "Price range by unit type"}</h3>
            <p className="mt-1 text-sm text-canopy/75">
              {bedrooms === "any" ? "All unit types" : `${bedrooms}-bedroom types`} at {describeEstimate(estimate, baseLevel)}.
            </p>
          </div>
          <div role="group" aria-label="Show prices as" className="flex rounded-full bg-mist-deep p-1">
            {(["table", "chart"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`rounded-full px-4 py-1.5 font-display-normal text-sm font-medium ${view === v ? "bg-canopy text-mist" : "text-canopy/75 hover:text-canopy"}`}
              >
                {v === "table" ? "Table" : "Chart"}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          {view === "table" ? (
            enabled ? (
              <PriceMatrix base={base} estimate={estimate} bedrooms={bedrooms} />
            ) : (
              <p className="text-[1rem] text-canopy/80">Turn on illustrative prices to see the full price table.</p>
            )
          ) : (
            <>
        {!enabled ? (
          <p className="mt-2 text-[1rem] text-canopy/80">Turn on illustrative prices to see the range for each unit type.</p>
        ) : (
          <>
            <p className="text-sm text-canopy/75">Each bar runs from the type&apos;s lowest home to its highest.</p>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-display-normal text-sm text-canopy/85" aria-label="Legend">
              {bedroomsShown.map((b) => (
                <li key={b} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-3 rounded-sm" style={{ background: BEDROOM_COLOURS[b] }} />
                  {b} bedrooms
                </li>
              ))}
            </ul>

            <div className="mt-4" role="img" aria-label={`Illustrative price ranges for ${rows.length} unit types, from ${compactMoney(rows[0]?.price[0] ?? 0)} to ${compactMoney(Math.max(...rows.map((r) => r.price[1])))}. The same figures are in the table below.`}>
              {rows.map((r) => {
                const active = hover === r.key;
                return (
                  <div
                    key={r.key}
                    className="grid grid-cols-1 items-center gap-x-3 border-t border-canopy/[0.07] py-1.5 sm:grid-cols-[200px_1fr]"
                  >
                    <p className="font-display-normal text-sm leading-tight">
                      <span className="font-semibold">{r.name}</span>
                      <span className="block text-[0.8125rem] text-stone">
                        {r.areaSqft.toLocaleString("en-SG")} sq ft · {r.homes} units
                      </span>
                    </p>
                    <div className="relative mr-28 h-8">
                      {ticks.map((t) => (
                        <span key={t} aria-hidden="true" className="absolute inset-y-0 w-px bg-canopy/[0.08]" style={{ left: `${pct(t)}%` }} />
                      ))}
                      <div
                        tabIndex={0}
                        onMouseEnter={() => setHover(r.key)}
                        onMouseLeave={() => setHover(null)}
                        onFocus={() => setHover(r.key)}
                        onBlur={() => setHover(null)}
                        aria-label={`${r.name}, ${r.areaSqft} sq ft: ${money(r.price[0])} to ${money(r.price[1])}`}
                        className="absolute inset-y-0 flex cursor-default items-center outline-none"
                        style={{ left: `${pct(r.price[0])}%`, width: `max(10px, ${pct(r.price[1]) - pct(r.price[0])}%)` }}
                      >
                        <span
                          className="h-3.5 w-full rounded"
                          style={{ background: r.bedrooms ? BEDROOM_COLOURS[r.bedrooms] : "#6f7a71", opacity: hover && !active ? 0.35 : 1 }}
                        />
                        <span className="absolute left-full ml-2 whitespace-nowrap font-display-normal text-[0.8125rem] tabular-nums text-canopy/85">
                          {compactMoney(r.price[0])}–{compactMoney(r.price[1])}
                        </span>
                        {active && (
                          <span
                            role="tooltip"
                            className="absolute bottom-full left-0 z-10 mb-1.5 whitespace-nowrap rounded-md bg-canopy px-2.5 py-1.5 font-display-normal text-[0.8125rem] leading-snug text-mist shadow-lg"
                          >
                            <strong className="font-semibold">{r.name}</strong>, {r.areaSqft.toLocaleString("en-SG")} sq ft
                            <br />
                            Levels {r.levels[0]}–{r.levels[1]}: {money(r.price[0])} to {money(r.price[1])}
                            <br />
                            {money(r.psf[0])}–{money(r.psf[1])} psf · {r.homes} units
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="grid grid-cols-1 gap-x-3 border-t border-canopy/15 sm:grid-cols-[200px_1fr]">
                <span className="hidden sm:block" />
                <div className="relative mr-28 h-6 font-display-normal text-[0.8125rem] tabular-nums text-stone">
                  {ticks.filter((t) => t % 1_000_000 === 0).map((t) => (
                    <span
                      key={t}
                      className="absolute top-1 whitespace-nowrap"
                      style={{ left: `${pct(t)}%`, transform: pct(t) < 3 ? "none" : "translateX(-50%)" }}
                    >
                      ${t / 1_000_000}M
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer font-display-normal text-sm font-semibold">Show as a table</summary>
              <div className="relative mt-2 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left font-display-normal text-sm tabular-nums">
                  <thead className="text-stone">
                    <tr className="border-b border-canopy/15">
                      <th className="py-1.5 pr-3 font-medium">Type</th>
                      <th className="py-1.5 pr-3 font-medium">Size</th>
                      <th className="py-1.5 pr-3 font-medium">Homes</th>
                      <th className="py-1.5 pr-3 font-medium">Levels</th>
                      <th className="py-1.5 pr-3 font-medium">PSF</th>
                      <th className="py-1.5 font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.key} className="border-b border-canopy/10">
                        <td className="py-1.5 pr-3">{r.name}</td>
                        <td className="py-1.5 pr-3">{r.areaSqft.toLocaleString("en-SG")} sq ft</td>
                        <td className="py-1.5 pr-3">{r.homes}</td>
                        <td className="py-1.5 pr-3">{r.levels[0]}–{r.levels[1]}</td>
                        <td className="py-1.5 pr-3">{money(r.psf[0])}–{money(r.psf[1])}</td>
                        <td className="py-1.5">{money(r.price[0])}–{money(r.price[1])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
