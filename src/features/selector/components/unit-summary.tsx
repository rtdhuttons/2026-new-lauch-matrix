"use client";

// The selected unit, revealed in stages: the essentials first (unit,
// bedrooms, size, floor, price, floor plan and two actions), then named
// sections for the supporting detail.

import type { Unit } from "../model/types";
import { describeClearFrom, levelView, VIEW_CATEGORY_LABEL } from "../lib/clearance";
import type { Engine } from "../lib/engine";
import { isPesType, money } from "../lib/format";
import { compassWords16 } from "../lib/geometry";
import type { PaymentEstimate } from "../lib/payments";
import { psf } from "../lib/pricing";
import { FloorPlan } from "./floor-plan";
import { btnPrimary, btnSecondary, btnText, card, Disclosure } from "./ui";

export const unitNumber = (u: Unit) => `#${String(u.level).padStart(2, "0")}-${u.stackId}`;

/** "Estimate" shown in words and with a mark, not by colour alone. */
export function EstimateTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#c9a45a] bg-[#fbf3df] px-2 py-0.5 font-display-normal text-xs font-semibold text-[#7a5410]">
      <span aria-hidden="true">≈</span> Estimate
    </span>
  );
}

export function UnitSummary({
  engine,
  unit,
  stackId,
  level,
  onLevel,
  inComparison,
  comparisonFull,
  onToggleComparison,
  onViewPayments,
  payment,
  priceNote,
  mrtName,
  footer,
}: {
  engine: Engine;
  unit: Unit | null;
  stackId: string;
  level: number;
  onLevel: (l: number) => void;
  inComparison: boolean;
  comparisonFull: boolean;
  onToggleComparison: (u: Unit) => void;
  onViewPayments: () => void;
  /** The buyer's payment estimate for this unit, when calculated. */
  payment: PaymentEstimate | null;
  /** How the price was set, e.g. the illustrative assumption. */
  priceNote: string | null;
  mrtName: string | null;
  /** Optional next step, e.g. "Explore units in this block". */
  footer?: React.ReactNode;
}) {
  const ix = engine.ix;
  const stack = ix.stack(stackId);
  const block = ix.stackBlock(stackId);
  const layout = ix.stackLayout(stackId);
  const stackUnits = ix.unitsInStack(stackId);
  const levels = stackUnits.map((u) => u.level);
  const idx = levels.indexOf(level);
  const lower = idx > 0 ? levels[idx - 1] : idx === -1 ? [...levels].reverse().find((l) => l < level) : undefined;
  const higher = idx >= 0 && idx < levels.length - 1 ? levels[idx + 1] : idx === -1 ? levels.find((l) => l > level) : undefined;

  if (!unit) {
    return (
      <aside aria-label="Selected unit" className={`${card} p-5 sm:p-6`}>
        <p className="font-display-normal text-lg font-semibold">Choose a unit to see its details.</p>
        <p className="mt-1 text-canopy/75">
          Stack {stackId} has no unit on floor {level}. Tap a unit on the site view or in the unit list.
        </p>
        {higher !== undefined && (
          <button type="button" onClick={() => onLevel(higher)} className={`${btnSecondary} mt-3`}>
            Go to floor {higher}
          </button>
        )}
      </aside>
    );
  }

  const a = engine.assess(unit);
  const view = engine.view(stackId);
  const lv = levelView(view, unit.level);
  const unitPsf = psf(ix, unit);
  const bedrooms = layout.category ?? (layout.bedrooms ? `${layout.bedrooms}-bedroom` : layout.name);

  return (
    <aside aria-label="Selected unit" aria-live="polite" className={`${card} overflow-hidden p-0`}>
      <div className="p-5 sm:p-6">
        <p className="font-display-normal text-xs font-semibold uppercase tracking-[0.16em] text-[#8a5a14]">Selected unit</p>
        <h3 className="mt-1 font-display text-[1.9rem] font-extrabold leading-tight">Unit {unitNumber(unit)}</h3>
        <p className="font-display-normal text-[0.9375rem] text-canopy/80">
          {bedrooms} · {block.name}
          {unit.typeCode ? ` · Type ${unit.typeCode}` : ""}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-mist p-3.5 font-display-normal">
          <div className="col-span-2">
            <dt className="text-xs text-canopy/65">{unit.priceIsEstimate ? "Estimated price" : "Price"}</dt>
            <dd className="font-display text-[1.75rem] font-extrabold leading-tight tabular-nums">{unit.price !== null ? money(unit.price) : "Not published"}</dd>
          </div>
          <div>
            <dt className="text-xs text-canopy/65">Size</dt>
            <dd className="font-semibold tabular-nums">{layout.areaSqft !== null ? `${layout.areaSqft.toLocaleString("en-SG")} sq ft` : "Not known"}</dd>
          </div>
          <div>
            <dt className="text-xs text-canopy/65">Floor</dt>
            <dd className="font-semibold tabular-nums">{unit.level}</dd>
          </div>
        </dl>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-display-normal text-sm text-canopy/75">
          {unit.price !== null && unit.priceIsEstimate && <EstimateTag />}
          {unitPsf !== null && (
            <span title="Price per sq ft: the unit price divided by its floor area.">
              {money(unitPsf)} per sq ft <span className="text-canopy/55">(price ÷ floor area)</span>
            </span>
          )}
        </div>
        {unit.priceIsEstimate && priceNote && <p className="mt-1 text-xs text-stone">{priceNote}</p>}

        <div className="mt-3 flex items-center gap-2 font-display-normal text-sm">
          <button type="button" className={btnText} disabled={lower === undefined} onClick={() => lower !== undefined && onLevel(lower)}>
            {lower !== undefined ? `‹ Floor ${lower}` : ""}
          </button>
          <span className="flex-1 text-center text-canopy/60">Same stack, other floors</span>
          <button type="button" className={btnText} disabled={higher === undefined} onClick={() => higher !== undefined && onLevel(higher)}>
            {higher !== undefined ? `Floor ${higher} ›` : ""}
          </button>
        </div>

        {unit.floorPlan && (
          <div className="mt-3 rounded-xl border border-canopy/10 bg-white p-2">
            <FloorPlan unit={unit} compact />
          </div>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => onToggleComparison(unit)} disabled={!inComparison && comparisonFull} className={inComparison ? btnSecondary : btnPrimary}>
            {inComparison ? "Remove from comparison" : "Add to comparison"}
          </button>
          <button type="button" onClick={onViewPayments} className={inComparison ? btnPrimary : btnSecondary}>
            View payment estimate
          </button>
        </div>
        {!inComparison && comparisonFull && <p className="mt-2 text-sm text-[#8a5a14]">You&apos;re comparing 3 units. Remove one to add another.</p>}
        {footer}
      </div>

      <div className="grid gap-2 border-t border-canopy/10 bg-mist/50 p-3">
        <Disclosure title="Facing & view" hint={`${compassWords16(stack.livingBearingDeg).replace(/^./, (c) => c.toUpperCase())}-facing · ${lv && lv.category !== "unknown" ? VIEW_CATEGORY_LABEL[lv.category] : "view not assessed"}`}>
          <dl className="grid gap-2 font-display-normal text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-canopy/70">Living room faces</dt>
              <dd className="text-right font-semibold">{compassWords16(stack.livingBearingDeg).replace(/^./, (c) => c.toUpperCase())}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-canopy/70">View at this floor</dt>
              <dd className="text-right font-semibold">{lv && lv.category !== "unknown" ? VIEW_CATEGORY_LABEL[lv.category] : "Not assessed"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-canopy/70">View clears from</dt>
              <dd className="text-right font-semibold">{describeClearFrom(view, block.storeys)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-canopy/70">Afternoon sun in the living room</dt>
              <dd className="text-right font-semibold">{a.sun.living.annualAverageMin !== null ? `About ${Math.round(a.sun.living.annualAverageMin)} min a day` : "Not estimated"}</dd>
            </div>
            {a.mrt.best && (
              <div className="flex justify-between gap-4">
                <dt className="text-canopy/70">Walk to {mrtName ?? "the MRT"}</dt>
                <dd className="text-right font-semibold">About {a.mrt.best.minutes} min</dd>
              </div>
            )}
          </dl>
          <p className="mt-3 text-xs text-stone">
            A stack is a column of units directly above one another, with the same layout and facing. This unit is in stack {stackId}.
            {unit.typeCode && isPesType(unit.typeCode) ? " It is the lowest unit in its stack, with a private enclosed space (PES)." : ""}
          </p>
        </Disclosure>

        <Disclosure title="Price by floor" hint={`Every floor in stack ${stackId}`}>
          <div className="relative max-h-72 overflow-auto">
            <table className="w-full border-collapse font-display-normal text-sm tabular-nums">
              <thead className="sticky top-0 bg-paper">
                <tr className="text-left text-xs text-canopy/65">
                  <th scope="col" className="py-1.5 pr-2 font-semibold">Floor</th>
                  <th scope="col" className="py-1.5 pr-2 text-right font-semibold">Price</th>
                  <th scope="col" className="py-1.5 text-right font-semibold">Per sq ft</th>
                </tr>
              </thead>
              <tbody>
                {[...stackUnits].reverse().map((u) => {
                  const p = psf(ix, u);
                  const on = u.id === unit.id;
                  return (
                    <tr key={u.id} className={`border-t border-canopy/10 ${on ? "bg-mist font-semibold" : ""}`}>
                      <td className="py-1.5 pr-2">
                        <button type="button" onClick={() => onLevel(u.level)} className="underline-offset-4 hover:underline" aria-current={on ? "true" : undefined}>
                          {u.level}{on ? " (selected)" : ""}
                        </button>
                      </td>
                      <td className="py-1.5 pr-2 text-right">{u.price !== null ? money(u.price) : "—"}</td>
                      <td className="py-1.5 text-right">{p !== null ? money(p) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {unit.priceIsEstimate && <p className="mt-2 text-xs text-stone">All prices here are estimates.</p>}
        </Disclosure>

        <Disclosure title="Payment breakdown" hint={payment ? "From the LTV, rate and loan period in step 4" : "Not calculated yet"}>
          {payment ? (
            <dl className="grid gap-1.5 font-display-normal text-sm tabular-nums">
              <div className="flex justify-between gap-4"><dt className="text-canopy/70">Loan ({payment.ltvPct}% LTV)</dt><dd className="font-semibold">{money(payment.loanAmount)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-canopy/70">Down payment (cash or CPF)</dt><dd className="font-semibold">{money(payment.downPayment)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-canopy/70">Buyer&apos;s Stamp Duty</dt><dd className="font-semibold">{money(payment.bsd)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-canopy/70">Additional Buyer&apos;s Stamp Duty ({Math.round(payment.absdRate * 100)}%)</dt><dd className="font-semibold">{money(payment.absd)}</dd></div>
              <div className="flex justify-between gap-4 border-t border-canopy/15 pt-1.5"><dt className="font-semibold">Total needed upfront</dt><dd className="font-semibold">{money(payment.upfront)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-canopy/70">Monthly loan payment after full loan disbursement</dt><dd className="font-semibold">{money(Math.round(payment.monthlyInstalment))}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-canopy/80">
              Enter your loan details to see the payments for this unit.{" "}
              <button type="button" onClick={onViewPayments} className={btnText}>Calculate payments</button>
            </p>
          )}
        </Disclosure>

        <Disclosure title="Assumptions & sources">
          <ul className="grid list-disc gap-1 pl-5 text-sm text-canopy/80">
            <li>Price: {unit.priceProvenance.source}{unit.priceProvenance.note ? `. ${unit.priceProvenance.note}` : ""} (checked {unit.priceProvenance.updated}).</li>
            <li>Size and type: {layout.provenance.source} (checked {layout.provenance.updated}).</li>
            {unit.floorPlan && <li>Floor plan: {unit.floorPlan.credit}</li>}
            {view.observed && <li>View clearance: {view.observed.provenance.source} (checked {view.observed.provenance.updated}).</li>}
            <li>Sun, facing and walking times are estimates from the site plan.</li>
          </ul>
        </Disclosure>
      </div>
    </aside>
  );
}
