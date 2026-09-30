"use client";

import { useState } from "react";
import type { Unit } from "../model/types";
import { unitLabel } from "../lib/dataset-index";
import type { Engine } from "../lib/engine";
import { money, pct, signedMoney } from "../lib/format";
import type { CostInputs, ScenarioAssumptions } from "../lib/scenario";
import {
  buyerStampDuty,
  DEFAULT_COSTS,
  defaultSsdPct,
  runScenario,
  SCENARIO_PRESETS,
} from "../lib/scenario";
import { card } from "./ui";

type PresetKey = keyof typeof SCENARIO_PRESETS;

function NumberField({
  id,
  label,
  value,
  onChange,
  step = 1,
  suffix,
  min,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  suffix?: string;
  min?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="font-display-normal text-sm font-medium text-canopy/85">
        {label}
      </label>
      <div className="mt-1 flex items-center rounded-md border border-canopy/20 bg-paper focus-within:border-reservoir">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          className="w-full rounded-md bg-transparent px-3 py-2 font-display-normal text-sm tabular-nums focus:outline-none"
        />
        {suffix && <span className="pr-3 font-display-normal text-sm text-stone">{suffix}</span>}
      </div>
    </div>
  );
}

export function ScenarioCalculator({
  engine,
  candidates,
  reference,
  holdingYears,
  onHoldingYears,
}: {
  engine: Engine;
  /** Units the buyer can analyse: current unit plus shortlist, priced only. */
  candidates: Unit[];
  reference: Unit | null;
  holdingYears: number;
  onHoldingYears: (y: number) => void;
}) {
  const ix = engine.ix;
  const priced = candidates.filter((u) => u.price !== null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preset, setPreset] = useState<PresetKey | "custom">("base");
  const [assumptions, setAssumptions] = useState<ScenarioAssumptions>(SCENARIO_PRESETS.base);
  const [costs, setCosts] = useState<CostInputs>(DEFAULT_COSTS);

  const others = priced.filter((u) => u.id !== reference?.id);
  const selected = others.find((u) => u.id === selectedId) ?? others[0] ?? null;

  if (!ix.ds.units.some((u) => u.price !== null)) {
    return (
      <div className={`${card} p-6`}>
        <p className="font-display-normal font-semibold">Awaiting the developer&apos;s price list.</p>
        <p className="mt-1 text-canopy/75">
          The premium and resale scenarios compare real purchase prices, so they switch on once the price list is loaded.
        </p>
      </div>
    );
  }
  if (!reference || reference.price === null) {
    return (
      <div className={`${card} p-6`}>
        <p className="font-display-normal font-semibold">Set a reference unit first.</p>
        <p className="mt-1 text-canopy/75">Use &ldquo;Set as reference&rdquo; on any available unit.</p>
      </div>
    );
  }
  if (!selected) {
    return (
      <div className={`${card} p-6`}>
        <p className="font-display-normal font-semibold">Pick a unit to compare with the reference.</p>
        <p className="mt-1 text-canopy/75">Select another available unit on the floor slider or add one to your shortlist.</p>
      </div>
    );
  }

  const refArea = ix.stackLayout(reference.stackId).areaSqft;
  const selArea = ix.stackLayout(selected.stackId).areaSqft;
  if (refArea === null || selArea === null) {
    return (
      <div className={`${card} p-6`}>
        <p className="font-display-normal font-semibold">Unit sizes are needed for this calculation.</p>
        <p className="mt-1 text-canopy/75">The premium is split by size, so it needs the developer&apos;s unit schedule.</p>
      </div>
    );
  }
  const refIn = { price: reference.price, areaSqft: refArea };
  const selIn = { price: selected.price!, areaSqft: selArea };
  const result = runScenario(refIn, selIn, holdingYears, assumptions, costs);
  const allPresets = (Object.keys(SCENARIO_PRESETS) as PresetKey[]).map((k) => ({
    key: k,
    r: runScenario(refIn, selIn, holdingYears, SCENARIO_PRESETS[k], costs),
  }));
  const ssd = costs.ssdPct ?? defaultSsdPct(holdingYears);
  const setCost = <K extends keyof CostInputs>(k: K, v: CostInputs[K]) => setCosts({ ...costs, [k]: v });

  const rows: { label: string; ref: string; sel: string }[] = [
    { label: "Purchase price", ref: money(result.reference.price), sel: money(result.selected.price) },
    { label: "Scenario resale price", ref: money(result.reference.resale), sel: money(result.selected.resale) },
    { label: "Gross gain", ref: signedMoney(result.reference.grossGain), sel: signedMoney(result.selected.grossGain) },
    { label: "Gross return", ref: pct(result.reference.grossPct), sel: pct(result.selected.grossPct) },
    { label: "Acquisition costs", ref: money(result.reference.costs.acquisition), sel: money(result.selected.costs.acquisition) },
    { label: "Interest paid", ref: money(result.reference.costs.financing), sel: money(result.selected.costs.financing) },
    { label: "Holding costs", ref: money(result.reference.costs.holding), sel: money(result.selected.costs.holding) },
    { label: "Selling costs", ref: money(result.reference.costs.selling), sel: money(result.selected.costs.selling) },
    { label: "Net gain after entered costs", ref: signedMoney(result.reference.netGain), sel: signedMoney(result.selected.netGain) },
  ];

  return (
    <div className={`${card} p-4 sm:p-6`}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="font-display-normal text-sm font-medium text-canopy/85">Reference unit</p>
          <p className="mt-1 font-display-normal font-semibold">{unitLabel(ix, reference)}</p>
          <p className="font-display-normal text-sm text-stone">{money(reference.price)}</p>
        </div>
        <div>
          <label htmlFor="scenario-unit" className="font-display-normal text-sm font-medium text-canopy/85">
            Compare with
          </label>
          <select
            id="scenario-unit"
            value={selected.id}
            onChange={(e) => setSelectedId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-canopy/20 bg-paper px-3 py-2 font-display-normal text-sm"
          >
            {others.map((u) => (
              <option key={u.id} value={u.id}>
                {unitLabel(ix, u)}, {money(u.price!)}
              </option>
            ))}
          </select>
        </div>
        <NumberField id="hold" label="Holding period" value={holdingYears} min={1} onChange={(v) => onHoldingYears(Math.max(1, Math.min(30, Math.round(v))))} suffix="years" />
      </div>

      <fieldset className="mt-6">
        <legend className="font-display-normal text-sm font-semibold">Scenario (assumptions, not forecasts)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(SCENARIO_PRESETS) as PresetKey[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={preset === k}
              onClick={() => {
                setPreset(k);
                setAssumptions(SCENARIO_PRESETS[k]);
              }}
              className={`rounded-full border px-4 py-1.5 font-display-normal text-sm font-medium capitalize ${
                preset === k ? "border-canopy bg-canopy text-mist" : "border-canopy/20"
              }`}
            >
              {k}: {SCENARIO_PRESETS[k].growthPct}% a year, {SCENARIO_PRESETS[k].retainedPremiumPct}% premium kept
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <NumberField
            id="growth"
            label="Overall market growth"
            value={assumptions.growthPct}
            step={0.5}
            suffix="% a year"
            onChange={(v) => {
              setPreset("custom");
              setAssumptions({ ...assumptions, growthPct: v });
            }}
          />
          <NumberField
            id="retained"
            label="Share of today's premium kept at resale"
            value={assumptions.retainedPremiumPct}
            step={5}
            min={0}
            suffix="%"
            onChange={(v) => {
              setPreset("custom");
              setAssumptions({ ...assumptions, retainedPremiumPct: v });
            }}
          />
        </div>
      </fieldset>

      <details className="mt-6 rounded-lg border border-canopy/10 p-4">
        <summary className="cursor-pointer font-display-normal text-sm font-semibold">
          Costs you can adjust
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField id="absd" label="Additional buyer's stamp duty" value={costs.absdPct} suffix="%" step={1} min={0} onChange={(v) => setCost("absdPct", v)} />
          <NumberField id="legal-buy" label="Legal fees to buy" value={costs.legalBuy} suffix="$" step={500} min={0} onChange={(v) => setCost("legalBuy", v)} />
          <NumberField id="ltv" label="Loan" value={costs.loanToValuePct} suffix="% of price" step={5} min={0} onChange={(v) => setCost("loanToValuePct", v)} />
          <NumberField id="rate" label="Interest rate" value={costs.interestPct} suffix="% a year" step={0.1} min={0} onChange={(v) => setCost("interestPct", v)} />
          <NumberField id="tenure" label="Loan tenure" value={costs.loanTenureYears} suffix="years" min={1} onChange={(v) => setCost("loanTenureYears", v)} />
          <NumberField id="monthly" label="Maintenance and property tax" value={costs.monthlyHolding} suffix="$ a month" step={50} min={0} onChange={(v) => setCost("monthlyHolding", v)} />
          <NumberField id="agent" label="Agent fee when selling" value={costs.agentFeePct} suffix="%" step={0.5} min={0} onChange={(v) => setCost("agentFeePct", v)} />
          <NumberField id="ssd" label="Seller's stamp duty" value={ssd} suffix="%" step={1} min={0} onChange={(v) => setCost("ssdPct", v)} />
        </div>
        <p className="mt-3 text-sm text-canopy/75">
          Buyer&apos;s stamp duty is worked out from the residential bands ({money(buyerStampDuty(selIn.price))} for the compared unit). Seller&apos;s stamp duty defaults to 16%, 12%, 8% or 4% when sold within one to four years of buying, for homes bought from 4 July 2025; check current IRAS rules. Interest assumes the full loan is drawn at purchase, which overstates it for a new launch paid in stages.
        </p>
      </details>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left font-display-normal text-sm">
          <caption className="mb-2 text-left font-semibold">
            {preset === "custom" ? "Custom" : preset[0].toUpperCase() + preset.slice(1)} scenario over {holdingYears} years
          </caption>
          <thead className="text-stone">
            <tr className="border-b border-canopy/15">
              <th className="py-2 pr-3 font-medium"></th>
              <th className="py-2 pr-3 font-medium">Reference, {unitLabel(ix, reference)}</th>
              <th className="py-2 font-medium">Compared, {unitLabel(ix, selected)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-canopy/10">
                <th scope="row" className="py-2 pr-3 font-medium text-canopy/80">{r.label}</th>
                <td className="py-2 pr-3 tabular-nums">{r.ref}</td>
                <td className="py-2 tabular-nums">{r.sel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-lg border-l-4 border-reservoir bg-mist p-4">
        <p className="font-display-normal text-sm font-semibold">Resale price needed to match the reference unit&apos;s return</p>
        <p className="mt-1 font-display text-xl font-extrabold tabular-nums">{money(result.requiredResale)}</p>
        <p className="mt-1 text-[1rem]">
          {result.shortfall > 500
            ? `This scenario's resale price is ${money(result.shortfall)} short of it, so the extra paid would earn a lower percentage return than the reference.`
            : result.shortfall < -500
              ? `This scenario's resale price beats it by ${money(-result.shortfall)}.`
              : "This scenario's resale price matches it."}
        </p>
        <p className="mt-2 text-sm text-canopy/80">
          Required resale price = compared purchase price × (reference scenario resale ÷ reference purchase price) = {money(selIn.price)} × {(result.reference.resale / refIn.price).toFixed(4)}.
        </p>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left font-display-normal text-sm">
          <caption className="mb-2 text-left font-semibold">All three scenarios for the compared unit</caption>
          <thead className="text-stone">
            <tr className="border-b border-canopy/15">
              <th className="py-2 pr-3 font-medium">Scenario</th>
              <th className="py-2 pr-3 font-medium">Resale</th>
              <th className="py-2 pr-3 font-medium">Needed to match reference</th>
              <th className="py-2 font-medium">Net gain</th>
            </tr>
          </thead>
          <tbody>
            {allPresets.map(({ key, r }) => (
              <tr key={key} className="border-b border-canopy/10">
                <th scope="row" className="py-2 pr-3 font-medium capitalize">{key}</th>
                <td className="py-2 pr-3 tabular-nums">{money(r.selected.resale)}</td>
                <td className="py-2 pr-3 tabular-nums">{money(r.requiredResale)}</td>
                <td className="py-2 tabular-nums">{signedMoney(r.selected.netGain)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 max-w-[72ch] text-[1rem] text-canopy/85">
        <p className="font-display-normal text-sm font-semibold">How the premium is kept separate from market growth</p>
        <p className="mt-1">
          The compared unit&apos;s price is split into a size-adjusted base ({money(result.sizeAdjustedBase)}: the reference unit&apos;s PSF × this unit&apos;s area) and a premium ({signedMoney(result.premium)}) for floor, view, facing or layout. Market growth of {assumptions.growthPct}% a year applies once to both parts. Only the premium is then scaled by the share kept at resale ({assumptions.retainedPremiumPct}%), so the premium is never grown twice or mistaken for extra growth.
        </p>
      </div>
    </div>
  );
}
