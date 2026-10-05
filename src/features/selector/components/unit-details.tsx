"use client";

import { useState } from "react";
import type { Unit } from "../model/types";
import { describeClearFrom, VIEW_CATEGORY_LABEL } from "../lib/clearance";
import { unitLabel } from "../lib/dataset-index";
import type { Engine } from "../lib/engine";
import { POTENTIAL_LABEL } from "../lib/exposure";
import { areaText, heightText, metres, money, psfText, signedMoney } from "../lib/format";
import { compassWords } from "../lib/geometry";
import { clearanceCost, onOffer, premiumOver, psf } from "../lib/pricing";
import type { Facade, SunState } from "../lib/solar";
import { formatClock, formatMinutes, MONTHS } from "../lib/solar";
import { card, StatusChip, ViewChip } from "./ui";

type Tab = "price" | "sun" | "view" | "noise" | "mrt" | "resale";

const TABS: { id: Tab; label: string }[] = [
  { id: "price", label: "Price & premium" },
  { id: "sun", label: "Sun & facing" },
  { id: "view", label: "View clearance" },
  { id: "noise", label: "Noise & privacy" },
  { id: "mrt", label: "MRT access" },
  { id: "resale", label: "Resale competition" },
];

function sunStateText(s: SunState): string {
  switch (s.kind) {
    case "sunlit":
      return "Direct sun on the window";
    case "night":
      return "Sun below the horizon";
    case "facing-away":
      return "Sun is behind this facade";
    case "overhang":
      return "Shaded by the balcony or ledge above";
    case "building":
      return `Shaded by ${s.name}`;
  }
}

function MonthBars({ values, label }: { values: number[]; label: string }) {
  const max = 300;
  return (
    <figure>
      <figcaption className="font-display-normal text-sm font-semibold">{label}</figcaption>
      <div className="mt-2 flex h-24 items-end gap-1" role="img"
        aria-label={`${label}: ${values.map((v, i) => `${MONTHS[i]} ${formatMinutes(v)}`).join(", ")}`}>
        {values.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t-sm bg-[#e0a21b]"
              style={{ height: `${Math.max(2, (v / max) * 80)}px`, opacity: v === 0 ? 0.25 : 1 }}
            />
            <span className="font-display-normal text-[0.6875rem] text-stone">{MONTHS[i][0]}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

export function UnitDetails({
  engine,
  unit,
  reference,
  month,
  minutes,
  onMonth,
  onMinutes,
}: {
  engine: Engine;
  unit: Unit | null;
  reference: Unit | null;
  month: number;
  minutes: number;
  onMonth: (m: number) => void;
  onMinutes: (m: number) => void;
}) {
  const [tab, setTab] = useState<Tab>("price");
  if (!unit) return null;
  const ix = engine.ix;
  const a = engine.assess(unit);
  const layout = ix.stackLayout(unit.stackId);
  const stack = ix.stack(unit.stackId);
  const block = ix.stackBlock(unit.stackId);

  return (
    <div className={`${card} p-4 sm:p-6`}>
      <div role="tablist" aria-label="Unit assessments" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-md px-3 py-2 font-display-normal text-sm font-medium ${
              tab === t.id ? "bg-canopy text-mist" : "text-canopy/75 hover:bg-mist"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-5">
        {tab === "price" && <PricePanel engine={engine} unit={unit} reference={reference} />}

        {tab === "sun" && (
          <div className="grid gap-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={a.sun.status} />
              <p className="text-sm text-canopy/75">{a.sun.method}</p>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              {(["living", "master"] as Facade[]).map((f) => {
                const e = a.sun[f];
                const state = engine.sunProvider.stateAt(unit, f, month, minutes);
                return (
                  <div key={f} className="rounded-lg bg-mist p-4">
                    <dt className="font-display-normal text-sm font-semibold">
                      {f === "living" ? "Living room & balcony" : "Master bedroom"} faces {compassWords(e.bearingDeg)}{" "}
                      <span className="font-normal text-stone">({Math.round(e.bearingDeg)}°)</span>
                    </dt>
                    <dd className="mt-2 font-display-normal text-lg font-semibold">
                      {formatMinutes(e.annualAverageMin)} <span className="text-sm font-normal">average direct afternoon sun</span>
                    </dd>
                    <dd className="text-sm text-canopy/80">
                      {e.peakMonths.length ? `Most in ${e.peakMonths.join(", ")}` : "No direct afternoon sun in any month"}
                    </dd>
                    <dd className="mt-2 text-sm">
                      <span className="font-display-normal font-semibold">
                        21 {MONTHS[month]}, {formatClock(minutes)}:
                      </span>{" "}
                      {sunStateText(state)}
                    </dd>
                    <dd className="mt-2 text-sm text-canopy/80">
                      {e.shading.byOverhangMin > 0 && "The overhang above blocks some high afternoon sun. "}
                      {e.shading.byBuildings.length > 0
                        ? `Also shaded by ${e.shading.byBuildings.map((b) => `${b.name} (${b.months.join(", ")})`).join("; ")}.`
                        : "No nearby building shades this window in the afternoon at this floor."}
                    </dd>
                  </div>
                );
              })}
            </dl>

            <div className="grid gap-4 sm:grid-cols-2">
              <MonthBars values={a.sun.living.monthlyAfternoonMin} label="Living room: direct afternoon sun by month" />
              <MonthBars values={a.sun.master.monthlyAfternoonMin} label="Master bedroom: direct afternoon sun by month" />
            </div>

            <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
              <fieldset>
                <legend className="font-display-normal text-sm font-semibold">Month</legend>
                <div className="mt-1.5 grid grid-cols-6 gap-1">
                  {MONTHS.map((m, i) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={month === i}
                      onClick={() => onMonth(i)}
                      className={`rounded px-2 py-1 font-display-normal text-sm ${month === i ? "bg-canopy text-mist" : "bg-mist hover:bg-mist-deep"}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor="sun-time" className="flex justify-between font-display-normal text-sm font-semibold">
                  <span>Time of day</span>
                  <span className="tabular-nums">{formatClock(minutes)}</span>
                </label>
                <input
                  id="sun-time"
                  type="range"
                  min={7 * 60}
                  max={19 * 60}
                  step={15}
                  value={minutes}
                  aria-valuetext={formatClock(minutes)}
                  onChange={(e) => onMinutes(Number(e.target.value))}
                  className="mt-2 w-full accent-[#c88a12]"
                />
              </div>
            </div>

            <div className="max-w-[70ch] text-[1rem] text-canopy/85">
              <p className="font-display-normal text-sm font-semibold">Trade-offs, not a ranking</p>
              <p className="mt-1">
                Singapore is almost on the equator, so the sun passes nearly overhead. West-facing rooms get the most afternoon heat all year. North-facing rooms get some afternoon sun from about May to August and south-facing ones from about November to January, which is why north or south facings are often preferred, but not automatically best.
              </p>
              <p className="mt-2">
                Less direct sun means cooler rooms and lower air-conditioning use, but it can also mean darker rooms and slower-drying laundry. A deep balcony shades high midday sun but not low evening sun, and a neighbouring block can shade lower floors in some months only.
              </p>
            </div>
          </div>
        )}

        {tab === "view" && (
          <div className="grid gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <ViewChip category={a.level?.category ?? "unknown"} uncertain={a.level?.uncertain} />
              <StatusChip status={a.view.status} provenance={a.view.observed?.provenance ?? a.view.governing?.obstruction.heightProvenance} />
            </div>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="font-display-normal text-sm text-stone">Main view direction</dt>
                <dd className="font-display-normal font-semibold">
                  {stack.mainView.label}, {compassWords(stack.mainView.bearingDeg)} ({Math.round(stack.mainView.bearingDeg)}°)
                </dd>
              </div>
              <div>
                <dt className="font-display-normal text-sm text-stone">Relevant obstruction</dt>
                <dd className="font-display-normal font-semibold">{a.view.observed ? a.view.observed.over.replace(/^the /, "The ") : a.view.governing?.obstruction.name ?? "None found"}</dd>
                {a.view.governing && !a.view.observed && (
                  <dd className="text-sm text-canopy/80">
                    {Math.round(a.view.governing.near)}–{Math.round(a.view.governing.far)} m away, top{" "}
                    {heightText(engine.ix.ds.project, a.view.governing.obstruction.topRL.min, a.view.governing.obstruction.topRL.max)}
                  </dd>
                )}
              </div>
              <div>
                <dt className="font-display-normal text-sm text-stone">Height source</dt>
                <dd className="text-sm">{a.view.observed ? `${a.view.observed.provenance.source}: ${a.view.observed.provenance.note}` : a.view.governing?.obstruction.heightProvenance.note ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-display-normal text-sm text-stone">Ground and eye level</dt>
                <dd className="font-display-normal font-semibold">
                  Ground {heightText(engine.ix.ds.project, block.groundRL)}; eye level {heightText(engine.ix.ds.project, a.level?.eyeRL ?? 0)} at level {unit.level}
                </dd>
              </div>
              <div>
                <dt className="font-display-normal text-sm text-stone">Estimated clearance floor</dt>
                <dd className="font-display-normal font-semibold">{describeClearFrom(a.view, block.storeys)}</dd>
              </div>
              <div>
                <dt className="font-display-normal text-sm text-stone">Future view risk</dt>
                <dd className="font-display-normal font-semibold capitalize">{a.view.futureRisk.level}</dd>
                {a.view.futureRisk.sites.map((s) => (
                  <dd key={s.id} className="text-sm text-canopy/80">
                    {s.name}: {s.planningNote}
                  </dd>
                ))}
              </div>
            </dl>
            <div className="max-w-[70ch] rounded-lg bg-mist p-4 text-[1rem]">
              <p className="font-display-normal text-sm font-semibold">How the marker is estimated</p>
              <p className="mt-1">
                Five sight lines are tested across the main view. A floor clears a line when a standing person&apos;s eye line reaches {a.view.target?.name ?? "the view"} over every obstruction, using ground levels, floor heights and distances, not the floor number. &ldquo;{VIEW_CATEGORY_LABEL.clear}&rdquo; means at least 4 of 5 lines clear; &ldquo;{VIEW_CATEGORY_LABEL["clear-limited"]}&rdquo; starts 3 floors above that, where extra height mostly adds a steeper angle rather than more view. Current clearance is separate from future risk: clearing today&apos;s buildings does not guarantee a permanent view.
              </p>
            </div>
          </div>
        )}

        {tab === "noise" && (
          <div className="grid gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={a.exposure.status} />
              <p className="text-sm text-canopy/75">
                Screening assessment from the site plan. Qualitative only: no measured or modelled sound levels.
              </p>
            </div>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[640px] text-left font-display-normal text-sm">
                <thead className="text-stone">
                  <tr className="border-b border-canopy/15">
                    <th className="py-2 pr-3 font-medium">Source</th>
                    <th className="py-2 pr-3 font-medium">Distance</th>
                    <th className="py-2 pr-3 font-medium">Rooms facing it</th>
                    <th className="py-2 pr-3 font-medium">At this floor</th>
                    <th className="py-2 font-medium">Likely active</th>
                  </tr>
                </thead>
                <tbody>
                  {a.exposure.noise.map((n) => (
                    <tr key={n.source.id} className="border-b border-canopy/10 align-top">
                      <td className="py-2 pr-3">
                        <span className="font-semibold">{n.source.name}</span>
                        <span className="block text-canopy/75">{n.description}</span>
                        {n.source.context && (
                          <span className="mt-1 block text-canopy/75">{n.source.context}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {metres(n.distanceM)} {n.direction}
                      </td>
                      <td className="py-2 pr-3">{n.exposedRooms.length ? n.exposedRooms.join(", ") : "None directly"}</td>
                      <td className="py-2 pr-3">
                        <span className="font-semibold">{POTENTIAL_LABEL[n.potential]}</span>
                        <span className="block text-canopy/75">
                          {n.lineOfSight === "direct" ? "Direct line of sight" : `Screened by ${n.screenedBy}`}
                        </span>
                        {n.heightAboveM !== null && (
                          <span className="block text-canopy/75">Eye level about {n.heightAboveM} m above it</span>
                        )}
                      </td>
                      <td className="py-2">{n.source.activity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="grid gap-2 text-[1rem]">
              {a.exposure.privacy.length === 0 && <li>No facing windows found within 80 m of the main rooms.</li>}
              {a.exposure.privacy.map((p, i) => (
                <li key={i}>
                  <span className="font-display-normal text-sm font-semibold">
                    Privacy, {p.room.toLowerCase()}
                    {p.potential ? ` (${POTENTIAL_LABEL[p.potential].toLowerCase()})` : ""}:
                  </span>{" "}
                  {p.description}
                </li>
              ))}
            </ul>
            <p className="max-w-[70ch] text-sm text-canopy/75">
              Higher floors are not assumed to be quieter. The line of sight to each source is checked at this floor, so a unit that rises above a screening block can become more exposed to road noise.
            </p>
          </div>
        )}

        {tab === "mrt" && (
          <div className="grid gap-5">
            {a.mrt.best ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip status={a.mrt.status} provenance={a.mrt.best.external.provenance} />
                  <p className="text-sm text-canopy/75">{a.mrt.best.internal.provenance.note ?? "Estimated route; not walked or timed."}</p>
                </div>
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="font-display-normal text-sm text-stone">Walk to {a.mrt.destination}</dt>
                    <dd className="font-display-normal text-lg font-semibold">
                      About {a.mrt.best.minutes} min, {metres(a.mrt.best.totalM)}
                    </dd>
                    <dd className="text-sm text-canopy/75">
                      Straight line {metres(a.mrt.straightLineM ?? 0)}, shown for comparison only
                    </dd>
                  </div>
                  <div>
                    <dt className="font-display-normal text-sm text-stone">Gate used</dt>
                    <dd className="font-display-normal font-semibold">{a.mrt.best.gate.name}</dd>
                    <dd className="text-sm text-canopy/75">{a.mrt.best.gate.opening}</dd>
                  </div>
                  <div>
                    <dt className="font-display-normal text-sm text-stone">Inside the development</dt>
                    <dd className="font-display-normal font-semibold">
                      {metres(a.mrt.best.internal.distanceM)} from {block.name} to the gate
                    </dd>
                  </div>
                  <div>
                    <dt className="font-display-normal text-sm text-stone">Covered</dt>
                    <dd className="font-display-normal font-semibold">
                      {a.mrt.best.coveredM !== null
                        ? `${metres(a.mrt.best.coveredM)} of ${metres(a.mrt.best.totalM)}`
                        : a.mrt.best.external.coveredM
                          ? `${metres(a.mrt.best.external.coveredM)} outside the gate`
                          : "Unknown for part of the route"}
                    </dd>
                    {a.mrt.best.coveredM === null && a.mrt.best.external.coveredM ? (
                      <dd className="text-sm text-canopy/75">Shelter inside the development not confirmed</dd>
                    ) : null}
                  </div>
                </dl>
                <p className="text-[1rem]">Crossings: {a.mrt.best.external.crossings}.</p>
                {a.mrt.options.length > 1 && (
                  <p className="text-sm text-canopy/75">
                    Other option: {a.mrt.options.slice(1).map((o) => `${o.gate.name}, about ${o.minutes} min (${metres(o.totalM)})`).join("; ")}.
                  </p>
                )}
                <p className="text-sm text-canopy/75">Times use 80 m a minute and exclude waiting for lifts.</p>
              </>
            ) : (
              <p>No walking route recorded for this block. Distance to the MRT is unknown.</p>
            )}
          </div>
        )}

        {tab === "resale" && (
          <div className="grid gap-5">
            <p className="max-w-[70ch] text-[1rem]">
              Resale competition asks: how many similar units could a future buyer choose instead of yours? It counts potential competition. It does not predict that those owners will sell at the same time.
            </p>
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="font-display-normal text-sm text-stone">Similar units in this development</dt>
                <dd className="font-display-normal text-lg font-semibold">{a.resale.known ? a.resale.similarCount : "Unknown"}</dd>
                <dd className="text-sm text-canopy/75">
                  {a.resale.known
                    ? `${layout.bedrooms} bedrooms within 10% of ${areaText(layout.areaSqft)}; ${a.resale.sameLayoutCount} of them are the same ${layout.name} layout`
                    : "Needs unit types and sizes from the developer"}
                </dd>
              </div>
              <div>
                <dt className="font-display-normal text-sm text-stone">Share this unit&apos;s view category</dt>
                <dd className="font-display-normal text-lg font-semibold">
                  {a.resale.sameViewCategoryCount} of {a.resale.similarCount}
                </dd>
              </div>
              <div>
                <dt className="font-display-normal text-sm text-stone">Nearby comparable projects</dt>
                {a.resale.nearby.length === 0 && <dd>None recorded</dd>}
                {a.resale.nearby.map((n) => (
                  <dd key={n.project.id} className="text-sm">
                    <span className="font-display-normal font-semibold">{n.project.name}</span>: {n.units} units with {layout.bedrooms} bedrooms, {n.project.completion.toLowerCase()}, {n.project.distanceKm} km <StatusChip status={n.project.provenance.status} provenance={n.project.provenance} />
                  </dd>
                ))}
              </div>
            </dl>
            {a.resale.floorEvidence && (
              <div className="rounded-lg border border-canopy/10 p-4">
                <p className="font-display-normal text-sm font-semibold">
                  Floor band: {a.resale.floorEvidence.band.label.toLowerCase()} floors ({a.resale.floorEvidence.band.floors} at {a.resale.floorEvidence.project})
                </p>
                <p className="mt-1 text-[1rem]">
                  At {a.resale.floorEvidence.project}, {a.resale.floorEvidence.band.homes} resales on these floors made{" "}
                  {money(a.resale.floorEvidence.band.avgProfit)} on average, {(a.resale.floorEvidence.band.annualised * 100).toFixed(2)}% a year. That adds{" "}
                  <strong>{a.resale.floorEvidence.points} of 30</strong> points to this unit&apos;s exit appeal.{" "}
                  <a href="#floor-profit" className="font-display-normal text-sm font-medium text-reservoir underline underline-offset-2">See profit by floor band</a>
                </p>
              </div>
            )}
            {a.resale.score !== null && (
              <p className="font-display-normal text-base">
                <span className="font-semibold">Exit appeal: {a.resale.score} / 100.</span>{" "}
                <span className="text-canopy/75">Less competition (up to 50) plus floor band record (up to 30), out of 80, rescaled to 100.</span>
              </p>
            )}
            <p className="rounded-lg bg-mist p-4 text-[1rem]">{a.resale.evidence.note}</p>
          </div>
        )}
      </div>
      <p className="mt-6 font-display-normal text-sm text-stone">
        Showing {unitLabel(ix, unit)}. {ix.ds.project.isDemo ? "All figures are illustrative demo data." : "Estimates are marked with their data status."}
      </p>
    </div>
  );
}

function PricePanel({ engine, unit, reference }: { engine: Engine; unit: Unit; reference: Unit | null }) {
  const ix = engine.ix;
  const view = engine.view(unit.stackId);
  const cost = clearanceCost(ix, view, unit);
  const premium = reference ? premiumOver(ix, unit, reference) : null;
  const ladder = ix.unitsInStack(unit.stackId).filter(onOffer);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={unit.priceProvenance.status} provenance={unit.priceProvenance} />
        <p className="text-sm text-canopy/75">
          {ix.ds.project.display?.pricingNote ?? "Only units on sale have prices; none are interpolated."}
        </p>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="font-display-normal text-sm text-stone">{unit.priceIsEstimate ? "Estimated total price" : "Total price"}</dt>
          <dd className="font-display-normal text-lg font-semibold">{unit.price !== null ? money(unit.price) : "Not published"}</dd>
        </div>
        <div>
          <dt className="font-display-normal text-sm text-stone">Area and PSF</dt>
          <dd className="font-display-normal text-lg font-semibold">
            {areaText(ix.stackLayout(unit.stackId).areaSqft)}{psf(ix, unit) !== null && `, ${psfText(psf(ix, unit)!)}`}
          </dd>
        </div>
        <div>
          <dt className="font-display-normal text-sm text-stone">Cost to reach view clearance in this stack</dt>
          <dd className="font-display-normal text-lg font-semibold">
            {cost.costToClear !== null ? signedMoney(cost.costToClear) : "Not measurable"}
          </dd>
          <dd className="text-sm text-canopy/75">
            {cost.costToClear !== null
              ? `Level ${cost.below!.level} to level ${cost.firstClear!.level}, the nearest available units either side`
              : "Needs available units both below and above the clearance range"}
          </dd>
        </div>
        <div>
          <dt className="font-display-normal text-sm text-stone">Paid above the first clear floor</dt>
          <dd className="font-display-normal text-lg font-semibold">
            {cost.extraAboveClear !== null ? signedMoney(cost.extraAboveClear) : "—"}
          </dd>
        </div>
      </dl>
      {premium && reference && unit.id !== reference.id && (
        <p className="text-[1rem]">
          {signedMoney(premium.amount)} versus the reference {unitLabel(ix, reference)}
          {premium.perFloor !== null && `, or ${signedMoney(premium.perFloor)} per floor within this stack`}.
          {premium.likeForLike.differences.length > 0 &&
            ` Not a like-for-like comparison: ${premium.likeForLike.differences.join("; ")}.`}
        </p>
      )}
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[520px] text-left font-display-normal text-sm">
          <caption className="mb-2 text-left font-semibold">Available units in stack {unit.stackId}</caption>
          <thead className="text-stone">
            <tr className="border-b border-canopy/15">
              <th className="py-1.5 pr-3 font-medium">Level</th>
              <th className="py-1.5 pr-3 font-medium">Price</th>
              <th className="py-1.5 pr-3 font-medium">PSF</th>
              <th className="py-1.5 pr-3 font-medium">Change from previous available floor</th>
              <th className="py-1.5 font-medium">View</th>
            </tr>
          </thead>
          <tbody>
            {ladder.map((u, i) => {
              const prev = ladder[i - 1];
              const lv = view.levels.find((l) => l.level === u.level)!;
              return (
                <tr key={u.id} className={`border-b border-canopy/10 ${u.id === unit.id ? "bg-mist font-semibold" : ""}`}>
                  <td className="py-1.5 pr-3 tabular-nums">{u.level}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{money(u.price!)}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{psfText(psf(ix, u)!)}</td>
                  <td className="py-1.5 pr-3 tabular-nums">
                    {prev
                      ? `${signedMoney(u.price! - prev.price!)} over ${u.level - prev.level} floor${u.level - prev.level > 1 ? "s" : ""} (${signedMoney((u.price! - prev.price!) / (u.level - prev.level))} each)`
                      : "—"}
                  </td>
                  <td className="py-1.5">{VIEW_CATEGORY_LABEL[lv.category]}{lv.uncertain ? " (uncertain)" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="max-w-[70ch] text-[1rem] text-canopy/85">
        The most desirable unit is not always the best value at its current price. Compare the step in price between floors with the step in view category: a large jump that stays in the same category buys height, not a better view.
      </p>
    </div>
  );
}
