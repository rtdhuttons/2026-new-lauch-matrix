"use client";

// Compare 2–3 units as cards: the same fields in the same order for every
// unit, a plain-language difference against the lowest-priced selection,
// and an option to show only the fields that differ.

import { useState } from "react";
import type { Unit } from "../model/types";
import { levelView, VIEW_CATEGORY_LABEL } from "../lib/clearance";
import type { Engine } from "../lib/engine";
import { money } from "../lib/format";
import { compassWords16 } from "../lib/geometry";
import type { PaymentInputs } from "../lib/payments";
import { estimatePayments } from "../lib/payments";
import { psf } from "../lib/pricing";
import { AssetImg } from "./asset-image";
import { EstimateTag, unitNumber } from "./unit-summary";
import { btnText, card } from "./ui";

interface Row {
  key: string;
  label: string;
  values: string[];
  /** Raw values used to decide whether the units differ. */
  raw: (string | number | null)[];
}

const floorsText = (n: number) => `${Math.abs(n)} floor${Math.abs(n) === 1 ? "" : "s"}`;

/** "Costs S$80,000 more and is 5 floors higher than #14-01." */
export function differenceSentence(engine: Engine, a: Unit, base: Unit): string {
  const ix = engine.ix;
  const parts: string[] = [];
  if (a.price !== null && base.price !== null && a.price !== base.price) {
    const d = a.price - base.price;
    parts.push(`costs S$${Math.abs(d).toLocaleString("en-SG")} ${d > 0 ? "more" : "less"}`);
  }
  const df = a.level - base.level;
  if (df !== 0) parts.push(`is ${floorsText(df)} ${df > 0 ? "higher" : "lower"}`);
  const sa = ix.stackLayout(a.stackId).areaSqft;
  const sb = ix.stackLayout(base.stackId).areaSqft;
  if (sa !== null && sb !== null && sa !== sb) parts.push(`is ${Math.abs(sa - sb).toLocaleString("en-SG")} sq ft ${sa > sb ? "larger" : "smaller"}`);
  const fa = compassWords16(ix.stack(a.stackId).livingBearingDeg);
  const fb = compassWords16(ix.stack(base.stackId).livingBearingDeg);
  if (fa !== fb) parts.push(`faces ${fa} instead of ${fb}`);
  if (parts.length === 0) return `Same price, size, floor and facing as ${unitNumber(base)}.`;
  const last = parts.pop()!;
  const text = parts.length ? `${parts.join(", ")} and ${last}` : last;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} than ${unitNumber(base)}.`;
}

export function CompareCards({
  engine,
  units,
  payments,
  onRemove,
  onSelect,
}: {
  engine: Engine;
  units: Unit[];
  payments: PaymentInputs;
  onRemove: (u: Unit) => void;
  onSelect: (u: Unit) => void;
}) {
  const ix = engine.ix;
  const [diffOnly, setDiffOnly] = useState(false);

  if (units.length < 2) {
    return (
      <div className={`${card} p-5`}>
        <p className="font-display-normal font-semibold">Select at least 2 units to compare.</p>
        <p className="mt-1 text-canopy/75">
          {units.length === 1 ? "You've added 1 unit. Add another from the site view or the unit list." : "Add units from the site view or the unit list with “Add to comparison”."}
        </p>
      </div>
    );
  }

  const priced = units.filter((u) => u.price !== null);
  const cheapest = priced.length === units.length ? priced.reduce((a, b) => (b.price! < a.price! ? b : a)) : null;
  const uniqueCheapest = cheapest && priced.filter((u) => u.price === cheapest.price).length === 1 ? cheapest : null;
  const base = uniqueCheapest ?? units[0];
  const anyEstimate = units.some((u) => u.priceIsEstimate);

  const est = units.map((u) => estimatePayments(u.price, payments));
  const rows: Row[] = [
    {
      key: "price",
      label: "Total price",
      values: units.map((u) => (u.price !== null ? money(u.price) : "Not published")),
      raw: units.map((u) => u.price),
    },
    {
      key: "size",
      label: "Size",
      values: units.map((u) => {
        const a = ix.stackLayout(u.stackId).areaSqft;
        return a !== null ? `${a.toLocaleString("en-SG")} sq ft` : "Not known";
      }),
      raw: units.map((u) => ix.stackLayout(u.stackId).areaSqft),
    },
    {
      key: "layout",
      label: "Layout",
      values: units.map((u) => {
        const l = ix.stackLayout(u.stackId);
        return `${l.category ?? `${l.bedrooms}-bedroom`}${u.typeCode ? `, Type ${u.typeCode}` : ""}`;
      }),
      raw: units.map((u) => u.typeCode ?? ix.stackLayout(u.stackId).id),
    },
    { key: "floor", label: "Floor", values: units.map((u) => String(u.level)), raw: units.map((u) => u.level) },
    {
      key: "facing",
      label: "Living room faces",
      values: units.map((u) => compassWords16(ix.stack(u.stackId).livingBearingDeg).replace(/^./, (c) => c.toUpperCase())),
      raw: units.map((u) => compassWords16(ix.stack(u.stackId).livingBearingDeg)),
    },
    {
      key: "view",
      label: "View at this floor",
      values: units.map((u) => {
        const v = levelView(engine.view(u.stackId), u.level);
        return v && v.category !== "unknown" ? VIEW_CATEGORY_LABEL[v.category] : "Not assessed";
      }),
      raw: units.map((u) => levelView(engine.view(u.stackId), u.level)?.category ?? null),
    },
    {
      key: "psf",
      label: "Price per sq ft",
      values: units.map((u) => {
        const p = psf(ix, u);
        return p !== null ? money(p) : "—";
      }),
      raw: units.map((u) => psf(ix, u)),
    },
    {
      key: "upfront",
      label: "Down payment (cash or CPF)",
      values: est.map((e) => (e.ok ? money(e.value.downPayment) : "Add loan details in step 4")),
      raw: est.map((e) => (e.ok ? e.value.downPayment : null)),
    },
    {
      key: "monthly",
      label: "Monthly loan payment (full loan)",
      values: est.map((e) => (e.ok ? money(Math.round(e.value.monthlyInstalment)) : "Add loan details in step 4")),
      raw: est.map((e) => (e.ok ? Math.round(e.value.monthlyInstalment) : null)),
    },
  ];
  const differs = (r: Row) => new Set(r.raw.map((v) => String(v))).size > 1;
  const shown = diffOnly ? rows.filter((r) => differs(r) || r.key === "price") : rows;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-display-normal text-sm text-canopy/75">
          Comparing {units.length} units.{anyEstimate ? " Prices are estimates." : ""}
        </p>
        <label className="flex items-center gap-2 font-display-normal text-sm font-semibold">
          <input type="checkbox" checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)} className="size-4 accent-canopy" />
          Show differences only
        </label>
      </div>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {units.map((u, i) => {
          const isBase = u.id === base.id;
          return (
            <li key={u.id} className={`${card} flex flex-col overflow-hidden p-0 ${uniqueCheapest?.id === u.id ? "ring-2 ring-canopy" : ""}`}>
              <div className="border-b border-canopy/10 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-xl font-extrabold">Unit {unitNumber(u)}</p>
                    <p className="text-sm text-canopy/75">{ix.stackBlock(u.stackId).name}</p>
                  </div>
                  {u.priceIsEstimate && <EstimateTag />}
                </div>
                {uniqueCheapest?.id === u.id && (
                  <p className="mt-2 inline-flex items-center gap-1 font-display-normal text-sm font-semibold">
                    <span aria-hidden="true">✓</span> Lowest price among your selections
                  </p>
                )}
                <p className="mt-2 text-[0.9375rem] text-canopy/85">{isBase ? "The other units are compared with this one." : differenceSentence(engine, u, base)}</p>
              </div>
              {u.floorPlan && (
                <button type="button" onClick={() => onSelect(u)} className="block border-b border-canopy/10 bg-white p-2" aria-label={`Select unit ${unitNumber(u)} to see its floor plan`}>
                  <AssetImg src={u.floorPlan.src} alt="" loading="lazy" className="mx-auto block h-36 w-auto object-contain" />
                </button>
              )}
              <dl className="grid flex-1 gap-0 font-display-normal text-sm">
                {shown.map((r) => (
                  <div key={r.key} className={`flex justify-between gap-3 border-b border-canopy/10 px-4 py-2 ${differs(r) ? "" : "text-canopy/70"}`}>
                    <dt className="text-canopy/70">{r.label}</dt>
                    <dd className={`text-right tabular-nums ${differs(r) ? "font-semibold" : ""}`}>{r.values[i]}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex justify-between gap-3 px-4 py-3">
                <button type="button" onClick={() => onSelect(u)} className={btnText}>View details</button>
                <button type="button" onClick={() => onRemove(u)} className="font-display-normal text-sm font-semibold text-[#9b2f28]">Remove</button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-stone">
        Bold values differ between the units. Payments use the loan details you entered for every unit, so the difference in price shows up in the cash
        needed upfront.
      </p>
    </div>
  );
}
