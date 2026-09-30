"use client";

import type { ReactNode } from "react";
import type { DataStatus, Unit } from "../model/types";
import { describeClearFrom, VIEW_CATEGORY_LABEL } from "../lib/clearance";
import { unitLabel, weakestStatus } from "../lib/dataset-index";
import type { Criterion, Engine, UnitAssessment } from "../lib/engine";
import { CRITERIA } from "../lib/engine";
import { POTENTIAL_LABEL } from "../lib/exposure";
import { areaText, compactMoney, money, psfText, signedMoney } from "../lib/format";
import { compassPoint } from "../lib/geometry";
import { clearanceCost, compareLayouts, premiumOver, psf } from "../lib/pricing";
import type { Preferences } from "../lib/recommend";
import { lifestyleFit } from "../lib/recommend";
import { formatMinutes } from "../lib/solar";
import { card, StatusChip } from "./ui";

interface Row {
  label: string;
  cells: ReactNode[];
  /** Index of the best cell, highlighted when the difference matters. */
  best?: number | null;
  note?: string;
}

function bestIndex(values: (number | null)[], higherIsBetter: boolean, minGap: number): number | null {
  const known = values.map((v, i) => ({ v, i })).filter((x) => x.v !== null) as { v: number; i: number }[];
  if (known.length < 2) return null;
  const sorted = [...known].sort((a, b) => (higherIsBetter ? b.v - a.v : a.v - b.v));
  return Math.abs(sorted[0].v - sorted[1].v) >= minGap ? sorted[0].i : null;
}

export function Comparison({
  engine,
  shortlist,
  reference,
  prefs,
  onRemove,
  onOpen,
  onSetReference,
}: {
  engine: Engine;
  shortlist: Unit[];
  reference: Unit | null;
  prefs: Preferences;
  onRemove: (u: Unit) => void;
  onOpen: (u: Unit) => void;
  onSetReference: (u: Unit) => void;
}) {
  const ix = engine.ix;
  if (shortlist.length === 0) {
    return (
      <div className={`${card} p-6`}>
        <p className="font-display-normal font-semibold">Your shortlist is empty.</p>
        <p className="mt-1 text-canopy/75">
          Add up to three units from the floor slider or the recommendations to compare them side by side.
        </p>
      </div>
    );
  }

  const as: UnitAssessment[] = shortlist.map((u) => engine.assess(u));
  const layouts = shortlist.map((u) => ix.stackLayout(u.stackId));
  const costs = shortlist.map((u) => clearanceCost(ix, engine.view(u.stackId), u));
  const fits = as.map((a) => lifestyleFit(a, prefs.weights));

  const groups: { title: string; rows: Row[] }[] = [
    {
      title: "Layout",
      rows: [
        { label: "Layout", cells: layouts.map((l) => (l.bedrooms === null ? l.name : `${l.name}, ${l.bedrooms} bedrooms`)) },
        { label: "Area", cells: layouts.map((l) => areaText(l.areaSqft)) },
        {
          label: "Features",
          cells: layouts.map((l) => (l.features.length ? l.features.join(", ") : "None listed")),
        },
        {
          label: "Differences from the first unit",
          cells: layouts.map((l, i) =>
            i === 0 ? "—" : compareLayouts(l, layouts[0]).differences.join("; ") || "Same layout",
          ),
        },
      ],
    },
    {
      title: "Entry price & premium",
      rows: [
        {
          label: shortlist.some((u) => u.priceIsEstimate) ? "Price (estimate)" : "Price",
          cells: shortlist.map((u) => (u.price !== null ? money(u.price) : "Not published")),
          best: bestIndex(shortlist.map((u) => u.price), false, 10_000),
        },
        {
          label: "PSF",
          cells: shortlist.map((u) => (psf(ix, u) !== null ? psfText(psf(ix, u)!) : "—")),
          best: bestIndex(shortlist.map((u) => psf(ix, u)), false, 20),
        },
        {
          label: `Versus reference ${reference ? unitLabel(ix, reference) : ""}`,
          cells: shortlist.map((u) => {
            if (!reference) return "Set a reference unit";
            if (u.id === reference.id) return "Reference";
            const p = premiumOver(ix, u, reference);
            if (!p) return "—";
            return `${signedMoney(p.amount)}${p.perFloor !== null ? ` (${signedMoney(p.perFloor)} per floor)` : ""}${p.likeForLike.sameLayout ? "" : ", different layout"}`;
          }),
        },
        {
          label: "Extra cost to reach view clearance in its stack",
          cells: costs.map((c) =>
            c.costToClear !== null ? `${signedMoney(c.costToClear)} (L${c.below!.level} to L${c.firstClear!.level})` : "Not measurable",
          ),
        },
        {
          label: "Paid for floors above clearance",
          cells: costs.map((c, i) =>
            c.extraAboveClear !== null
              ? `${signedMoney(c.extraAboveClear)} above L${c.firstClear!.level}, still ${VIEW_CATEGORY_LABEL[as[i].level?.category ?? "unknown"].toLowerCase()}`
              : "—",
          ),
        },
      ],
    },
    {
      title: "Sun exposure & facing",
      rows: [
        {
          label: "Living / master facing",
          cells: as.map(
            (a) => `${compassPoint(a.sun.living.bearingDeg)} / ${compassPoint(a.sun.master.bearingDeg)}`,
          ),
        },
        {
          label: "Average afternoon sun, living room",
          cells: as.map((a) => formatMinutes(a.sun.living.annualAverageMin)),
          best: bestIndex(as.map((a) => a.sun.living.annualAverageMin), false, 30),
        },
        {
          label: "Average afternoon sun, master bedroom",
          cells: as.map((a) => formatMinutes(a.sun.master.annualAverageMin)),
          best: bestIndex(as.map((a) => a.sun.master.annualAverageMin), false, 30),
        },
        {
          label: "Most exposed months (living)",
          cells: as.map((a) => a.sun.living.peakMonths.join(", ") || "None"),
        },
      ],
    },
    {
      title: "View clearance",
      rows: [
        {
          label: "View at this floor",
          cells: as.map(
            (a) => `${VIEW_CATEGORY_LABEL[a.level?.category ?? "unknown"]}${a.level?.uncertain ? " (uncertain)" : ""}`,
          ),
          best: bestIndex(as.map((a) => a.scores.view.score), true, 20),
        },
        {
          label: "Clearance floor",
          cells: as.map((a) => describeClearFrom(a.view, ix.stackBlock(a.unit.stackId).storeys)),
        },
        { label: "Main view", cells: as.map((a) => a.view.stack.mainView.label) },
        {
          label: "Future view risk",
          cells: as.map((a) => a.view.futureRisk.level[0].toUpperCase() + a.view.futureRisk.level.slice(1)),
        },
      ],
    },
    {
      title: "Noise & privacy",
      rows: [
        {
          label: "Main sources",
          cells: as.map((a) => {
            const top = a.exposure.noise.filter((n) => n.potential !== "lower").slice(0, 2);
            return top.length
              ? top.map((n) => `${n.source.name} (${POTENTIAL_LABEL[n.potential].toLowerCase()})`).join("; ")
              : "Only lower-potential sources";
          }),
        },
        {
          label: "Privacy",
          cells: as.map((a) => {
            const p = a.exposure.privacy.filter((x) => x.potential);
            return p.length ? p.map((x) => `${x.room}: ${x.distanceM ? `windows ${x.distanceM} m away` : "corridor-facing window"}`).join("; ") : "No close facing windows";
          }),
        },
        {
          label: "Screening score",
          cells: as.map((a) => `${Math.round(a.exposure.score)}/100`),
          best: bestIndex(as.map((a) => a.exposure.score), true, 10),
        },
      ],
    },
    {
      title: "MRT access",
      rows: [
        {
          label: "Walk to MRT",
          cells: as.map((a) => (a.mrt.best ? `About ${a.mrt.best.minutes} min, ${a.mrt.best.totalM} m` : "Unknown")),
          best: bestIndex(as.map((a) => a.mrt.best?.totalM ?? null), false, 60),
        },
        { label: "Gate", cells: as.map((a) => a.mrt.best?.gate.name ?? "Unknown") },
      ],
    },
    {
      title: "Resale competition",
      rows: [
        {
          label: "Similar units in the development",
          cells: as.map((a) => String(a.resale.similarCount)),
          best: bestIndex(as.map((a) => a.resale.similarCount), false, 15),
        },
        {
          label: "Distinctive benefits",
          cells: as.map((a) => a.resale.distinctive.join("; ") || "None found"),
        },
        { label: "Transaction evidence", cells: as.map(() => "Insufficient evidence") },
      ],
    },
    {
      title: "Fit & data confidence",
      rows: [
        {
          label: "Lifestyle fit",
          cells: fits.map((f) =>
            f.score === null ? "Unknown" : `${Math.round(f.score)}/100${f.coverage < 1 ? ` (${Math.round(f.coverage * 100)}% coverage)` : ""}`,
          ),
          best: bestIndex(fits.map((f) => f.score), true, 5),
        },
        ...CRITERIA.map(({ id, label }) => ({
          label: `${label} score`,
          cells: as.map((a) => scoreCell(a, id)),
        })),
        {
          label: "Weakest data status",
          cells: as.map((a) => {
            const s: DataStatus = weakestStatus(Object.values(a.scores).map((x) => x.status));
            return <StatusChip key="s" status={s} />;
          }),
        },
      ],
    },
  ];

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left">
          <thead>
            <tr className="border-b border-canopy/15 align-top">
              <th scope="col" className="w-[24%] p-4 font-display-normal text-sm font-medium text-stone">
                Compare {shortlist.length} of 3
              </th>
              {shortlist.map((u) => (
                <th key={u.id} scope="col" className="p-4">
                  <span className="block font-display text-base font-extrabold">{unitLabel(ix, u)}</span>
                  <span className="block font-display-normal text-sm font-medium text-stone">
                    {u.price !== null ? compactMoney(u.price) : "Not on sale"}
                    {reference?.id === u.id ? ", reference" : ""}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-display-normal text-sm font-medium">
                    <button type="button" onClick={() => onOpen(u)} className="text-reservoir underline underline-offset-2">
                      Show
                    </button>
                    {reference?.id !== u.id && u.price !== null && (
                      <button type="button" onClick={() => onSetReference(u)} className="text-reservoir underline underline-offset-2">
                        Set as reference
                      </button>
                    )}
                    <button type="button" onClick={() => onRemove(u)} className="text-canopy/70 underline underline-offset-2">
                      Remove
                    </button>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.title}>
              <tr className="bg-mist">
                <th colSpan={shortlist.length + 1} scope="colgroup" className="px-4 py-2 font-display-normal text-sm font-semibold">
                  {g.title}
                </th>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.label} className="border-b border-canopy/8 align-top">
                  <th scope="row" className="px-4 py-2.5 font-display-normal text-sm font-medium text-canopy/80">
                    {r.label}
                  </th>
                  {r.cells.map((c, i) => (
                    <td
                      key={i}
                      className={`px-4 py-2.5 font-display-normal text-sm ${r.best === i ? "bg-[#e3efe8] font-semibold text-[#155c3a]" : ""}`}
                    >
                      {c}
                      {r.best === i && <span className="sr-only"> (best of the shortlist)</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="border-t border-canopy/10 px-4 py-3 text-sm text-canopy/75">
        Green cells mark the best of the shortlist where the difference is meaningful. Sun, noise and route figures are estimates; check each row&apos;s data status.
      </p>
    </div>
  );
}

function scoreCell(a: UnitAssessment, id: Criterion) {
  const s = a.scores[id];
  return s.score === null ? "Unknown" : `${Math.round(s.score)}/100`;
}
