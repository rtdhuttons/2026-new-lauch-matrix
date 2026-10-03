"use client";

import type { Unit } from "../model/types";
import { VIEW_CATEGORY_LABEL, describeClearFrom } from "../lib/clearance";
import { unitLabel } from "../lib/dataset-index";
import type { Engine } from "../lib/engine";
import { isPesType, money } from "../lib/format";
import { compassWords16 } from "../lib/geometry";
import { psf } from "../lib/pricing";
import { FloorPlan } from "./floor-plan";

const millions = (n: number) => `$${(n / 1_000_000).toFixed(3)}m`;

/** The home picked on the 3D model: price, the key facts and its floor plan. */
export function UnitPanel({
  engine,
  stackId,
  unit,
  level,
  onLevel,
  onCompare,
  inCompare,
  compareFull,
  onFullAnalysis,
  onOpenUnits,
  mrtName,
  showPlan = true,
}: {
  /** Opens this home in Units & Payments; hidden when already there. */
  onOpenUnits?: () => void;
  /** Station name for the walking time, e.g. "Upper Thomson MRT". */
  mrtName?: string | null;
  /** Show the floor plan thumbnail (the Units tab shows it larger instead). */
  showPlan?: boolean;
  engine: Engine;
  stackId: string;
  unit: Unit | null;
  level: number;
  onLevel: (l: number) => void;
  onCompare: (u: Unit) => void;
  inCompare: boolean;
  compareFull: boolean;
  onFullAnalysis: () => void;
}) {
  const ix = engine.ix;
  const stack = ix.stack(stackId);
  const block = ix.stackBlock(stackId);
  const layout = ix.stackLayout(stackId);
  const levels = ix.unitsInStack(stackId).map((u) => u.level);
  const idx = levels.indexOf(level);
  const lower = idx > 0 ? levels[idx - 1] : idx === -1 ? [...levels].reverse().find((l) => l < level) : undefined;
  const higher = idx >= 0 && idx < levels.length - 1 ? levels[idx + 1] : idx === -1 ? levels.find((l) => l > level) : undefined;
  const a = unit ? engine.assess(unit) : null;
  const view = engine.view(stackId);
  const unitPsf = unit ? psf(ix, unit) : null;

  const stepButton = "grid size-10 place-items-center rounded-full border border-white/25 text-lg font-semibold text-white hover:bg-white/10 disabled:opacity-30";

  return (
    <aside aria-label="Selected home" aria-live="polite" className="rounded-2xl bg-canopy p-5 text-mist shadow-[0_18px_40px_-24px_rgb(16_41_28/0.8)] sm:p-6">
      <p className="font-display-normal text-xs font-semibold uppercase tracking-[0.16em] text-[#e3b27d]">Selected home</p>

      {unit ? (
        <>
          <h3 className="mt-2 font-display text-[1.75rem] font-extrabold leading-tight text-white">{unitLabel(ix, unit)}</h3>
          <p className="mt-1 font-display-normal text-sm text-mist/80">
            {unit.typeCode ? `Type ${unit.typeCode}` : layout.name}
            {layout.category ? ` · ${layout.category}` : ""}
            {block.collection ? ` · ${block.collection} Collection` : ""}
          </p>

          <div className="mt-4 rounded-xl bg-white/[0.07] p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="font-display-normal text-xs text-mist/70">{unit.priceIsEstimate ? "Estimated price" : "Price"}</p>
                <p className="font-display text-[2.1rem] font-extrabold leading-none tabular-nums text-[#f0c48f]">
                  {unit.price !== null ? `${unit.priceIsEstimate ? "~" : ""}${millions(unit.price)}` : "Awaiting"}
                </p>
              </div>
              {unit.priceIsEstimate && (
                <span className="rounded bg-white/15 px-1.5 py-0.5 font-display-normal text-[0.6875rem] font-bold uppercase tracking-wide text-white">Est.</span>
              )}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-3 font-display-normal text-sm">
              <div>
                <dt className="text-mist/65">Size</dt>
                <dd className="font-semibold text-white">{layout.areaSqft !== null ? `${layout.areaSqft.toLocaleString("en-SG")} sq ft` : "—"}</dd>
              </div>
              <div>
                <dt className="text-mist/65">PSF</dt>
                <dd className="font-semibold tabular-nums text-white">{unitPsf !== null ? money(unitPsf) : "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button type="button" className={stepButton} disabled={lower === undefined} onClick={() => lower !== undefined && onLevel(lower)} aria-label="Lower floor">
              −
            </button>
            <p className="text-center font-display-normal">
              <span className="block text-xs text-mist/65">Level</span>
              <span className="font-display text-2xl font-extrabold tabular-nums text-white">{unit.level}</span>
              <span className="block text-xs text-mist/65">
                of {levels[0]}–{levels[levels.length - 1]} in stack {stackId}
              </span>
            </p>
            <button type="button" className={stepButton} disabled={higher === undefined} onClick={() => higher !== undefined && onLevel(higher)} aria-label="Higher floor">
              +
            </button>
          </div>

          <dl className="mt-4 grid gap-2.5 border-t border-white/10 pt-4 font-display-normal text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-mist/65">Living room faces</dt>
              <dd className="text-right font-semibold text-white">
                {compassWords16(stack.livingBearingDeg).replace(/^./, (c) => c.toUpperCase())}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-mist/65">View</dt>
              <dd className="text-right font-semibold text-white">
                {a?.level && a.level.category !== "unknown" ? VIEW_CATEGORY_LABEL[a.level.category] : "Not assessed"}
                <span className="block text-xs font-normal text-mist/65">Clears from {describeClearFrom(view, block.storeys).replace(/^Level /, "level ")}</span>
              </dd>
            </div>
            {a?.mrt.best && (
              <div className="flex justify-between gap-4">
                <dt className="text-mist/65">{mrtName ?? "MRT"}</dt>
                <dd className="text-right font-semibold text-white">About {a.mrt.best.minutes} min walk</dd>
              </div>
            )}
            {unit.typeCode && isPesType(unit.typeCode) && (
              <p className="text-xs text-mist/75">Lowest home in the stack, with a private enclosed space (PES).</p>
            )}
          </dl>

          {showPlan && (
            <div className="mt-4 rounded-xl bg-white p-2 text-canopy">
              <FloorPlan unit={unit} compact />
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onCompare(unit)}
              disabled={!inCompare && compareFull}
              className="rounded-full bg-white px-4 py-2.5 font-display-normal text-sm font-semibold text-canopy hover:bg-mist disabled:opacity-50"
            >
              {inCompare ? "Remove from shortlist" : compareFull ? "Shortlist full (3)" : "Add to shortlist"}
            </button>
            <button
              type="button"
              onClick={onFullAnalysis}
              className="rounded-full border border-white/40 px-4 py-2.5 font-display-normal text-sm font-semibold text-white hover:bg-white/10"
            >
              Full analysis
            </button>
            {onOpenUnits && (
              <button
                type="button"
                onClick={onOpenUnits}
                className="col-span-2 rounded-full bg-[#ffbc36] px-4 py-2.5 font-display-normal text-sm font-semibold text-canopy hover:bg-[#ffc955]"
              >
                Open in Units &amp; Payments →
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="mt-3 grid gap-3">
          <p className="font-display text-xl font-extrabold text-white">Tap a home on the 3D model</p>
          <p className="text-sm text-mist/80">
            Stack {stackId} has no home on level {level}. Pick another floor, or tap any unit to see its price, size and floor plan here.
          </p>
          {higher !== undefined && (
            <button type="button" onClick={() => onLevel(higher)} className="justify-self-start rounded-full bg-white px-4 py-2 font-display-normal text-sm font-semibold text-canopy">
              Go to level {higher}
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
