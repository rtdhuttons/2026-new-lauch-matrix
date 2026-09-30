"use client";

import type { Criterion } from "../lib/engine";
import { CRITERIA } from "../lib/engine";
import { compactMoney } from "../lib/format";
import type { Preferences, Purpose } from "../lib/recommend";
import { PURPOSE_WEIGHTS } from "../lib/recommend";
import { Segmented } from "./ui";

const IMPORTANCE = ["Ignore", "Low", "Some", "Medium", "High", "Essential"];

const EXTRA_SPEND = [
  { value: 0, label: "Nothing extra" },
  { value: 100_000, label: "Up to $100k" },
  { value: 250_000, label: "Up to $250k" },
  { value: 400_000, label: "Up to $400k" },
  { value: -1, label: "No limit" },
];

export function PreferencesPanel({
  prefs,
  onChange,
  eligibleCount,
}: {
  prefs: Preferences;
  onChange: (p: Preferences) => void;
  eligibleCount: number;
}) {
  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    onChange({ ...prefs, [key]: value });
  const setWeight = (c: Criterion, w: number) =>
    onChange({ ...prefs, weights: { ...prefs.weights, [c]: w } });
  const totalWeight = Object.values(prefs.weights).reduce((a, b) => a + b, 0);

  return (
    <div className="grid gap-6">
      <Segmented<Purpose>
        label="Buying for"
        value={prefs.purpose}
        options={[
          { value: "own", label: "Own stay" },
          { value: "invest", label: "Investment" },
          { value: "both", label: "Both" },
        ]}
        onChange={(purpose) =>
          onChange({ ...prefs, purpose, weights: PURPOSE_WEIGHTS[purpose] })
        }
      />

      <div className="grid gap-4 rounded-lg border border-canopy/10 p-4">
        <p className="font-display-normal text-sm font-semibold">
          Essentials{" "}
          <span className="font-normal text-stone">(applied before ranking)</span>
        </p>
        <div>
          <label htmlFor="budget" className="flex justify-between font-display-normal text-sm">
            <span>Budget</span>
            <span className="font-semibold tabular-nums">{compactMoney(prefs.budget)}</span>
          </label>
          <input
            id="budget"
            type="range"
            min={1_300_000}
            max={3_600_000}
            step={50_000}
            value={prefs.budget}
            onChange={(e) => set("budget", Number(e.target.value))}
            className="mt-2 w-full accent-canopy"
          />
        </div>
        <Segmented<number | "any">
          label="Bedrooms"
          value={prefs.bedrooms}
          options={[
            { value: "any", label: "Any" },
            { value: 2, label: "2" },
            { value: 3, label: "3" },
            { value: 4, label: "4" },
          ]}
          onChange={(b) => set("bedrooms", b)}
        />
        <label className="flex items-start gap-2.5 font-display-normal text-sm">
          <input
            type="checkbox"
            checked={prefs.requireClearView}
            onChange={(e) => set("requireClearView", e.target.checked)}
            className="mt-0.5 size-4 accent-canopy"
          />
          Only units with an estimated clear main view
        </label>
        <p className="font-display-normal text-sm text-stone" aria-live="polite">
          {eligibleCount} available units meet these essentials.
        </p>
      </div>

      <div>
        <label htmlFor="holding" className="flex justify-between font-display-normal text-sm font-semibold">
          <span>Holding period</span>
          <span className="tabular-nums">{prefs.holdingYears} years</span>
        </label>
        <input
          id="holding"
          type="range"
          min={1}
          max={15}
          value={prefs.holdingYears}
          onChange={(e) => set("holdingYears", Number(e.target.value))}
          className="mt-2 w-full accent-canopy"
        />
        <p className="mt-1 text-sm text-stone">Used by the resale scenario calculator.</p>
      </div>

      <div>
        <label htmlFor="extra" className="font-display-normal text-sm font-semibold">
          Willing to pay for a better floor or view
        </label>
        <select
          id="extra"
          value={prefs.maxExtraSpend ?? -1}
          onChange={(e) => {
            const v = Number(e.target.value);
            set("maxExtraSpend", v < 0 ? null : v);
          }}
          className="mt-1.5 block w-full rounded-md border border-canopy/20 bg-paper px-3 py-2 font-display-normal text-sm"
        >
          {EXTRA_SPEND.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-stone">
          Measured above the cheapest unit that meets your essentials.
        </p>
      </div>

      <fieldset>
        <legend className="font-display-normal text-sm font-semibold">
          What matters to you
        </legend>
        <p className="mt-1 text-sm text-stone">
          These weights drive the lifestyle fit score. The share column shows how much each one counts.
        </p>
        <table className="mt-3 w-full font-display-normal text-sm">
          <thead className="sr-only">
            <tr>
              <th>Criterion</th>
              <th>Importance</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>
            {CRITERIA.map(({ id, label }) => {
              const w = prefs.weights[id];
              return (
                <tr key={id} className="border-t border-canopy/10">
                  <th scope="row" className="py-2 pr-2 text-left font-medium">
                    <label htmlFor={`w-${id}`}>{label}</label>
                    <span className="block text-[0.8125rem] font-normal text-stone">
                      {IMPORTANCE[w]}
                    </span>
                  </th>
                  <td className="w-[45%] py-2">
                    <input
                      id={`w-${id}`}
                      type="range"
                      min={0}
                      max={5}
                      value={w}
                      aria-valuetext={`${IMPORTANCE[w]} (${w} of 5)`}
                      onChange={(e) => setWeight(id, Number(e.target.value))}
                      className="w-full accent-reservoir"
                    />
                  </td>
                  <td className="w-12 py-2 text-right tabular-nums text-stone">
                    {totalWeight ? Math.round((w / totalWeight) * 100) : 0}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </fieldset>
    </div>
  );
}
