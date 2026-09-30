"use client";

import type { Unit, UnitStatus } from "../model/types";
import type { LevelView, StackViewAnalysis } from "../lib/clearance";
import { describeClearFrom, levelView, VIEW_CATEGORY_LABEL } from "../lib/clearance";
import { unitLabel } from "../lib/dataset-index";
import type { Engine } from "../lib/engine";
import { POTENTIAL_LABEL } from "../lib/exposure";
import { compactMoney, facingNote, heightText, isPesType, layoutSummary, money, psfText, signedMoney } from "../lib/format";
import { compassWords, compassWords16, floorRL } from "../lib/geometry";
import { FloorPlan } from "./floor-plan";
import { clearanceNarrative, premiumOver, psf } from "../lib/pricing";
import { card, StatusChip, ViewChip, VIEW_COLOURS } from "./ui";

const STATUS_TEXT: Record<UnitStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  sold: "Sold",
  "not-released": "Not yet released",
  pending: "Awaiting price list",
};

const ROW_H = 15;

function Elevation({
  engine,
  view,
  stackId,
  level,
  onLevel,
}: {
  engine: Engine;
  view: StackViewAnalysis;
  stackId: string;
  level: number;
  onLevel: (l: number) => void;
}) {
  const block = engine.ix.stackBlock(stackId);
  const units = engine.ix.unitsInStack(stackId);
  const levels = [...view.levels].reverse();
  const top = 24;
  const height = top + levels.length * ROW_H + 26;
  const width = 300;
  const yOf = (l: number) => top + (block.storeys - l) * ROW_H;
  const { optimistic, conservative } = view.clearFrom;
  const rangeTop = conservative ?? block.storeys + 1;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full max-w-[340px]"
      role="img"
      aria-label={`Elevation of stack ${stackId}: view clears from ${describeClearFrom(view, block.storeys)}`}
    >
      <defs>
        <pattern id="unavail" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="#10291c" strokeOpacity="0.28" strokeWidth="1.6" />
        </pattern>
      </defs>
      <text x="60" y="14" fontSize="10" className="fill-stone font-display-normal">
        Level
      </text>
      <text x="210" y="14" fontSize="10" className="fill-stone font-display-normal">
        Price
      </text>

      {optimistic !== null && optimistic !== conservative && (
        <rect
          x="84"
          y={yOf(rangeTop - 1)}
          width="118"
          height={(rangeTop - optimistic) * ROW_H}
          fill="none"
          stroke="#c88a12"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
      )}

      {levels.map((lv) => {
        const unit = units.find((u) => u.level === lv.level);
        const y = yOf(lv.level);
        const selected = lv.level === level;
        const unavailable = unit && unit.status !== "available";
        return (
          <g
            key={lv.level}
            onClick={() => onLevel(lv.level)}
            className="cursor-pointer"
            aria-hidden="true"
          >
            <text x="72" y={y + 11} textAnchor="end" fontSize="10" className="fill-canopy font-display-normal tabular-nums" fontWeight={selected ? 700 : 400}>
              {lv.level}
            </text>
            {lv.hasHomes ? (
              <>
                <rect x="86" y={y + 1} width="114" height={ROW_H - 2} fill={VIEW_COLOURS[lv.category]} />
                {lv.uncertain && (
                  <rect x="143" y={y + 1} width="57" height={ROW_H - 2} fill={VIEW_COLOURS[lv.optimisticCategory]} />
                )}
                {unavailable && <rect x="86" y={y + 1} width="114" height={ROW_H - 2} fill="url(#unavail)" />}
              </>
            ) : (
              <>
                <rect x="86" y={y + 1} width="114" height={ROW_H - 2} fill="#ffffff" stroke="#c3cac3" strokeDasharray="2 2" />
                <text x="143" y={y + 11} textAnchor="middle" fontSize="8.5" className="fill-stone font-display-normal">
                  No homes
                </text>
              </>
            )}
            {selected && (
              <rect x="83" y={y - 1} width="120" height={ROW_H + 2} fill="none" stroke="#10291c" strokeWidth="2.2" rx="2" />
            )}
            <text x="208" y={y + 11} fontSize="9.5" className="font-display-normal tabular-nums" fill={unit?.status === "available" ? "#10291c" : "#6f7a71"}>
              {unit ? (unit.price !== null ? compactMoney(unit.price) : unit.status === "pending" ? "Awaiting" : STATUS_TEXT[unit.status]) : ""}
            </text>
          </g>
        );
      })}

      {conservative !== null && (
        <g>
          <line x1="20" x2="204" y1={yOf(conservative) + ROW_H} y2={yOf(conservative) + ROW_H} stroke="#10291c" strokeWidth="2" />
          <path d={`M20,${yOf(conservative) + ROW_H - 5} l8,5 l-8,5 z`} fill="#10291c" />
          <text x="2" y={yOf(conservative) + ROW_H - 7} fontSize="9" fontWeight="700" className="fill-canopy font-display-normal">
            Clears
          </text>
        </g>
      )}
      {optimistic !== null && optimistic !== conservative && (
        <text x="2" y={yOf(optimistic) + 11} fontSize="8.5" fill="#9a6a12" className="font-display-normal">
          May clear
        </text>
      )}
      {optimistic === null && (
        <text x="143" y={top - 2} textAnchor="middle" fontSize="9" className="fill-canopy font-display-normal">
          View not cleared in this stack
        </text>
      )}
      <line x1="80" x2="206" y1={height - 22} y2={height - 22} stroke="#10291c" />
      <text x="143" y={height - 8} textAnchor="middle" fontSize="9" className="fill-stone font-display-normal">
        Ground {heightText(engine.ix.ds.project, block.groundRL)}
      </text>
    </svg>
  );
}

function ViewSection({
  engine,
  view,
  stackId,
  lv,
}: {
  engine: Engine;
  view: StackViewAnalysis;
  stackId: string;
  lv: LevelView;
}) {
  const block = engine.ix.stackBlock(stackId);
  const centre = view.rays.find((r) => r.offsetDeg === 0 && r.targetDistance !== null)
    ?? view.rays.find((r) => r.targetDistance !== null);
  if (!centre || !view.target) {
    return <p className="text-sm text-stone">No sight line to assess for this stack.</p>;
  }
  const gov = centre.governing ?? view.governing;
  const dist = centre.targetDistance!;
  const W = 520;
  const H = 210;
  const pad = { l: 40, r: 12, t: 12, b: 30 };
  const blockTop = floorRL(block, block.storeys) + block.typicalFloorHeightM;
  const maxRL = Math.max(blockTop, gov?.obstruction.topRL.max ?? 0, view.target.surfaceRL) + 10;
  const minRL = Math.min(block.groundRL, view.target.surfaceRL, gov?.obstruction.baseRL ?? 999) - 8;
  const x = (d: number) => pad.l + ((d + 20) / (dist + 20)) * (W - pad.l - pad.r);
  const y = (rl: number) => pad.t + ((maxRL - rl) / (maxRL - minRL)) * (H - pad.t - pad.b);
  const eye = lv.eyeRL;
  const shortName = view.target.name.replace(/ \(.*\)$/, "");
  const targetLabel = shortName.charAt(0).toUpperCase() + shortName.slice(1);
  const clears = lv.category === "clear" || lv.category === "clear-limited";
  const lineColour = clears ? "#1d7a4f" : lv.clearedShare.optimistic > 0 ? "#c88a12" : "#b3413b";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
      aria-label={`Cross-section along the main view: eye level ${eye.toFixed(1)} m, ${gov ? `${gov.obstruction.name} ${Math.round(gov.near)}–${Math.round(gov.far)} m away with top ${gov.obstruction.topRL.min}–${gov.obstruction.topRL.max} m` : "no obstruction"}, ${view.target.name} ${Math.round(dist)} m away.`}>
      {[0, 50, 100, 150].filter((r) => r > minRL && r < maxRL).map((r) => (
        <g key={r}>
          <line x1={pad.l} x2={W - pad.r} y1={y(r)} y2={y(r)} stroke="#10291c" strokeOpacity="0.07" />
          <text x={pad.l - 6} y={y(r) + 3} textAnchor="end" fontSize="9" className="fill-stone font-display-normal">
            {r} m
          </text>
        </g>
      ))}
      {/* Stack */}
      <rect x={x(-18)} y={y(blockTop)} width={x(0) - x(-18)} height={y(block.groundRL) - y(blockTop)} fill="#dfe6dc" stroke="#10291c" strokeWidth="0.8" />
      <circle cx={x(0)} cy={y(eye)} r="4" fill="#10291c" />
      {/* Obstruction */}
      {gov && (
        <g>
          <rect x={x(gov.near)} y={y(gov.obstruction.topRL.min)} width={Math.max(3, x(gov.far) - x(gov.near))} height={y(gov.obstruction.baseRL) - y(gov.obstruction.topRL.min)} fill={gov.obstruction.kind === "tree-belt" ? "#bcd1b3" : "#d4d9d3"} stroke="#6f7a71" strokeWidth="0.6" />
          {gov.obstruction.topRL.max > gov.obstruction.topRL.min && (
            <rect x={x(gov.near)} y={y(gov.obstruction.topRL.max)} width={Math.max(3, x(gov.far) - x(gov.near))} height={y(gov.obstruction.topRL.min) - y(gov.obstruction.topRL.max)} fill="#c88a12" fillOpacity="0.18" stroke="#c88a12" strokeDasharray="3 2" strokeWidth="0.8" />
          )}
          <text x={x(gov.far) + 4} y={y(gov.obstruction.topRL.max) - 4} fontSize="9" className="fill-canopy font-display-normal">
            {gov.obstruction.name.replace(/ \(.*\)$/, "")}, top {gov.obstruction.topRL.min}
            {gov.obstruction.topRL.max !== gov.obstruction.topRL.min ? `–${gov.obstruction.topRL.max}` : ""} m
          </text>
        </g>
      )}
      {/* Target */}
      <line x1={x(dist - 40)} x2={x(dist)} y1={y(view.target.surfaceRL)} y2={y(view.target.surfaceRL)} stroke="#2e6a78" strokeWidth="4" />
      <text
        x={x(dist)}
        y={
          // Drop the label below the line when it would collide with the obstruction's label.
          gov && Math.abs(y(gov.obstruction.topRL.max) - y(view.target.surfaceRL)) < 16
            ? y(view.target.surfaceRL) + 14
            : y(view.target.surfaceRL) - 7
        }
        textAnchor="end"
        fontSize="9"
        className="fill-reservoir font-display-normal"
      >
        {targetLabel}
      </text>
      {/* Sight line */}
      <line x1={x(0)} y1={y(eye)} x2={x(dist)} y2={y(view.target.surfaceRL)} stroke={lineColour} strokeWidth="1.8" strokeDasharray={clears ? undefined : "6 4"} />
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#10291c" strokeOpacity="0.3" />
      <text x={x(0)} y={H - 12} fontSize="9" className="fill-stone font-display-normal">
        Stack {stackId}
      </text>
      <text x={W - pad.r} y={H - 12} textAnchor="end" fontSize="9" className="fill-stone font-display-normal">
        {Math.round(dist)} m along the main view ({compassWords(view.stack.mainView.bearingDeg)})
      </text>
    </svg>
  );
}

export function StackExplorer({
  engine,
  stackId,
  level,
  onLevel,
  reference,
  onSetReference,
  shortlist,
  onToggleShortlist,
  onShowShadows,
}: {
  engine: Engine;
  stackId: string;
  level: number;
  onLevel: (l: number) => void;
  reference: Unit | null;
  onSetReference: (u: Unit) => void;
  shortlist: string[];
  onToggleShortlist: (u: Unit) => void;
  /** Jump to the 3D site plan with shadows at 4pm. */
  onShowShadows?: () => void;
}) {
  const ix = engine.ix;
  const block = ix.stackBlock(stackId);
  const layout = ix.stackLayout(stackId);
  const stack = ix.stack(stackId);
  const view = engine.view(stackId);
  const units = ix.unitsInStack(stackId);
  const unit = units.find((u) => u.level === level) ?? null;
  const lv = levelView(view, level)!;
  const levels = ix.levelsForStack(stackId);
  const available = units.filter((u) => u.status === "available");
  const prevAvail = [...available].reverse().find((u) => u.level < level);
  const nextAvail = available.find((u) => u.level > level);
  const assessment = unit ? engine.assess(unit) : null;
  const premium = unit && reference ? premiumOver(ix, unit, reference) : null;
  const isRef = unit && reference && unit.id === reference.id;
  const onList = unit ? shortlist.includes(unit.id) : false;
  const narrative = unit && unit.status === "available" ? clearanceNarrative(ix, view, unit) : [];

  const valueText = unit
    ? `Level ${level}, ${STATUS_TEXT[unit.status]}${unit.price !== null ? `, ${money(unit.price)}` : ""}, ${VIEW_CATEGORY_LABEL[lv.category]}`
    : `Level ${level}, no homes on this level`;

  return (
    <div className={`${card} p-4 sm:p-6`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-display text-lg font-extrabold">
          Stack {stackId}{" "}
          <span className="font-display-normal text-base font-medium text-stone">
            {block.name}{block.collection ? `, ${block.collection} Collection` : ""}, {layoutSummary(layout)}
          </span>
        </h3>
        <p className="font-display-normal text-sm text-canopy/80">
          Main view: {stack.mainView.label} ({compassWords(stack.mainView.bearingDeg)})
        </p>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(240px,320px)_1fr]">
        <div>
          <div className="rounded-lg bg-mist p-3">
            <p className="font-display-normal text-sm font-semibold">View Clearance Floor Marker</p>
            <p className="mt-0.5 font-display text-xl font-extrabold tabular-nums">
              {describeClearFrom(view, block.storeys)}
            </p>
            <p className="mt-1 text-sm text-canopy/75">
              {view.target === null
                ? "No surveyed buildings or view target in this direction yet. The marker appears here once they are loaded."
                : <>The estimated first floor where the main view clears{" "}{view.governing ? view.governing.obstruction.name : "nearby obstructions"}.</>}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusChip status={view.status} provenance={view.governing?.obstruction.heightProvenance} />
              {view.clearFrom.optimistic !== view.clearFrom.conservative && (
                <span className="font-display-normal text-sm text-[#7a5410]">
                  Range because the obstruction height is uncertain
                </span>
              )}
            </div>
          </div>
          <div className="mt-4">
            <Elevation engine={engine} view={view} stackId={stackId} level={level} onLevel={onLevel} />
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-display-normal text-[0.8125rem] text-canopy/80">
            {(["below", "partial", "clear", "clear-limited"] as const).map((c) => (
              <li key={c} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ background: VIEW_COLOURS[c] }} />
                {VIEW_CATEGORY_LABEL[c]}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <svg width="12" height="12" aria-hidden="true"><rect width="12" height="12" fill="#e9ece8" /><path d="M0,12 L12,0" stroke="#10291c" strokeOpacity="0.4" /></svg>
              Not on sale
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm border border-dashed border-[#c88a12]" />
              Clearance range
            </li>
          </ul>
        </div>

        <div className="min-w-0">
          <label htmlFor="floor" className="font-display-normal text-sm font-semibold">
            Floor
          </label>
          <div className="mt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={() => prevAvail && onLevel(prevAvail.level)}
              disabled={!prevAvail}
              className="rounded-md border border-canopy/20 px-2.5 py-1.5 font-display-normal text-sm disabled:opacity-40"
              aria-label="Previous available floor"
            >
              Lower
            </button>
            <input
              id="floor"
              type="range"
              min={levels[0]}
              max={levels[levels.length - 1]}
              step={1}
              value={level}
              onChange={(e) => onLevel(Number(e.target.value))}
              aria-valuetext={valueText}
              className="w-full accent-canopy"
            />
            <button
              type="button"
              onClick={() => nextAvail && onLevel(nextAvail.level)}
              disabled={!nextAvail}
              className="rounded-md border border-canopy/20 px-2.5 py-1.5 font-display-normal text-sm disabled:opacity-40"
              aria-label="Next available floor"
            >
              Higher
            </button>
          </div>

          <div aria-live="polite" className="mt-4">
            {unit ? (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-display text-2xl font-extrabold tabular-nums">{unitLabel(ix, unit)}</p>
                  <span
                    className={`rounded-full px-2.5 py-1 font-display-normal text-sm font-medium ${
                      unit.status === "available" ? "bg-[#dcefe3] text-[#155c3a]" : "bg-mist-deep text-canopy/70"
                    }`}
                  >
                    {STATUS_TEXT[unit.status]}
                  </span>
                </div>
                {unit.typeCode && (
                  <p className="mt-1 font-display-normal text-base text-canopy/85">
                    Type {unit.typeCode}
                    {layout.category ? `, ${layout.category}` : ""}
                    {layout.areaSqft !== null ? `, ${layout.areaSqft.toLocaleString("en-SG")} sq ft` : ""}
                    {isPesType(unit.typeCode) ? ". Lowest home in the stack, with a private enclosed space (PES)" : ""}
                  </p>
                )}
                <div className="mt-3 rounded-lg border-l-4 border-[#c88a12] bg-[#fbf5e8] px-3 py-2">
                  <p className="font-display-normal text-sm">
                    <span className="font-semibold">
                      Living room faces {compassWords16(stack.livingBearingDeg)} ({Math.round(stack.livingBearingDeg)}°).
                    </span>{" "}
                    {facingNote(stack.livingBearingDeg)}
                    {assessment ? ` About ${Math.round(assessment.sun.living.annualAverageMin)} min of direct afternoon sun on an average day (estimate).` : ""}
                  </p>
                  {onShowShadows && (
                    <button
                      type="button"
                      onClick={onShowShadows}
                      className="mt-1 font-display-normal text-sm font-medium text-reservoir underline underline-offset-2"
                    >
                      See shadows at 4pm
                    </button>
                  )}
                </div>
                {stack.notes?.map((n) => (
                  <p key={n} className="mt-1 text-sm text-canopy/80">
                    {n}
                  </p>
                ))}
                <dl className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <dt className="font-display-normal text-sm text-stone">Price</dt>
                    <dd className="font-display-normal text-lg font-semibold tabular-nums">
                      {unit.price !== null ? money(unit.price) : "Not published"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-display-normal text-sm text-stone">PSF</dt>
                    <dd className="font-display-normal text-lg font-semibold tabular-nums">
                      {psf(ix, unit) !== null ? psfText(psf(ix, unit)!) : "—"}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="font-display-normal text-sm text-stone">
                      Versus reference {reference ? unitLabel(ix, reference) : "(none set)"}
                    </dt>
                    <dd className="font-display-normal text-lg font-semibold tabular-nums">
                      {isRef ? "This is the reference unit" : premium ? signedMoney(premium.amount) : "—"}
                      {premium?.perFloor != null && !isRef && (
                        <span className="ml-2 text-sm font-normal text-canopy/75">
                          {signedMoney(premium.perFloor)} per floor
                        </span>
                      )}
                    </dd>
                    {premium && !isRef && premium.likeForLike.differences.length > 0 && (
                      <dd className="text-sm text-[#7a5410]">
                        Not like-for-like: {premium.likeForLike.differences.join("; ")}
                      </dd>
                    )}
                  </div>
                </dl>
                {unit.status !== "available" && (
                  <p className="mt-3 text-sm text-canopy/75">
                    {unit.status === "pending"
                      ? "Awaiting the developer's price list. Prices and premiums appear here once it is released."
                      : "Prices are only shown for units on sale. We don't estimate this unit's price from neighbouring floors."}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <ViewChip category={lv.category} uncertain={lv.uncertain} />
{lv.category !== "unknown" && (
                  <span className="font-display-normal text-sm text-canopy/75">
                    {Math.round(lv.clearedShare.conservative * 100)}% of tested sight lines clear
                    {lv.uncertain ? ` (up to ${Math.round(lv.clearedShare.optimistic * 100)}% if the obstruction is lower)` : ""}
                  </span>
)}
                </div>

                {narrative.length > 0 && (
                  <div className="mt-3 rounded-lg border-l-4 border-reservoir bg-mist px-4 py-3">
                    {narrative.map((line, i) => (
                      <p key={i} className="text-[1rem] leading-relaxed">
                        {line}
                      </p>
                    ))}
                  </div>
                )}

                {assessment && (
                  <ul className="mt-3 grid gap-1 text-[1rem] text-canopy/85">
                    {assessment.exposure.privacy.slice(0, 2).map((p, i) => (
                      <li key={`p${i}`}>
                        <span className="font-display-normal text-sm font-semibold">{p.room}:</span> {p.description}
                      </li>
                    ))}
                    {assessment.exposure.noise
                      .filter((n) => n.potential === "higher")
                      .slice(0, 2)
                      .map((n) => (
                        <li key={n.source.id}>
                          <span className="font-display-normal text-sm font-semibold">{POTENTIAL_LABEL[n.potential]}:</span>{" "}
                          {n.description.toLowerCase().replace(/^potential /, "")} from {n.source.name}, {n.distanceM} m {n.direction}
                        </li>
                      ))}
                    {view.futureRisk.level !== "low" && (
                      <li>
                        <span className="font-display-normal text-sm font-semibold">Future view risk ({view.futureRisk.level}):</span>{" "}
                        {view.target === null
                          ? "Not assessed in this direction. "
                          : view.futureRisk.sites.some((s) => s.risk !== "low")
                            ? `${view.futureRisk.sites.filter((s) => s.risk !== "low").map((s) => s.name).join(", ")}. `
                            : ""}
                        Clearing today&apos;s buildings doesn&apos;t guarantee a permanent view.
                      </li>
                    )}
                  </ul>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleShortlist(unit)}
                    disabled={!onList && shortlist.length >= 3}
                    className={`rounded-full px-4 py-2 font-display-normal text-sm font-semibold disabled:opacity-50 ${
                      onList ? "border border-canopy text-canopy" : "bg-canopy text-mist hover:bg-canopy-soft"
                    }`}
                  >
                    {onList ? "Remove from shortlist" : shortlist.length >= 3 ? "Shortlist full (3)" : "Add to shortlist"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetReference(unit)}
                    disabled={unit.price === null || !!isRef}
                    className="rounded-full border border-canopy/25 px-4 py-2 font-display-normal text-sm font-semibold disabled:opacity-50"
                  >
                    {isRef ? "Reference unit" : "Set as reference"}
                  </button>
                </div>
                <FloorPlan unit={unit} />
              </>
            ) : (
              <p className="rounded-lg bg-mist p-4 font-display-normal">
                Level {level} has no homes in {block.name} (sky terrace).
              </p>
            )}
          </div>

          <div className="mt-6">
            <p className="font-display-normal text-sm font-semibold">Cross-section along the main view at level {level}</p>
            <p className="text-sm text-stone">
              Sight line from standing eye height ({heightText(ix.ds.project, lv.eyeRL)}) to {view.target?.name ?? "the view"}. Shaded band: uncertain obstruction height.
            </p>
            <div className="mt-2">
              <ViewSection engine={engine} view={view} stackId={stackId} lv={lv} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
