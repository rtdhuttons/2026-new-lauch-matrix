"use client";

// Alternative Projects: what other projects offer for a similar budget, unit
// type by unit type, beside this project's own units. This project's prices
// may be illustrative estimates and are labelled wherever they appear.

import { useState } from "react";
import type { AlternativeProject } from "../model/project";
import type { OwnUnitType } from "../lib/alternatives";
import { closestBySize, sizePriceSentence } from "../lib/alternatives";
import { AssetImg } from "./asset-image";
import { NotSupplied } from "./tabs";
import { EstimateTag } from "./unit-summary";
import { card } from "./ui";

const sgd = (n: number) => `S$${Math.round(n).toLocaleString("en-SG")}`;
const sgdM = (n: number) => `S$${(n / 1_000_000).toFixed(3)}M`;
const sizeText = (s: { min: number; max: number } | null) => (s ? (s.min === s.max ? s.min.toLocaleString("en-SG") : `${s.min.toLocaleString("en-SG")}–${s.max.toLocaleString("en-SG")}`) : "—");
const leftText = (n: number | null) => (n === null ? "Not stated" : n <= 5 ? `Only ${n} left` : `${n} left`);

interface Row {
  key: string;
  project: string;
  own: boolean;
  type: string;
  size: { min: number; max: number } | null;
  price: number;
  psf: number | null;
  left: string;
  estimate: boolean;
}

export function AlternativesTab({
  alternatives,
  projectName,
  ownTypes,
  selected,
}: {
  alternatives: AlternativeProject[];
  projectName: string;
  ownTypes: OwnUnitType[];
  /** The selected unit's type and price, to compare against. */
  selected: { label: string; type: OwnUnitType } | null;
}) {
  const bedroomOptions = [...new Set([...ownTypes.map((t) => t.bedrooms), ...alternatives.flatMap((a) => a.unitTypes.map((u) => u.bedrooms))])].sort((a, b) => a - b);
  const [bedrooms, setBedrooms] = useState(selected?.type.bedrooms ?? (bedroomOptions.includes(3) ? 3 : bedroomOptions[0]));
  const [sort, setSort] = useState<"price" | "size" | "psf">("price");

  if (alternatives.length === 0) {
    return (
      <NotSupplied
        title="Alternative projects have not been added yet."
        needed={[
          "An initial shortlist of three to five alternative projects, new launches or resale.",
          "Why you consider each one relevant.",
          "Their unit types, sizes and dated prices, each labelled with what the price is.",
        ]}
      />
    );
  }

  const rows: Row[] = [
    ...ownTypes
      .filter((t) => t.bedrooms === bedrooms)
      .map((t) => ({
        key: `own-${t.key}`,
        project: projectName,
        own: true,
        type: t.type,
        size: { min: t.sizeSqft, max: t.sizeSqft },
        price: t.fromPrice,
        psf: Math.round(t.fromPrice / t.sizeSqft),
        left: "Not released",
        estimate: t.isEstimate,
      })),
    ...alternatives.flatMap((a) =>
      a.unitTypes
        .filter((u) => u.bedrooms === bedrooms && u.fromPrice !== null)
        .map((u) => ({
          key: `${a.name}-${u.type}`,
          project: a.name,
          own: false,
          type: u.type,
          size: u.sizeSqft,
          price: u.fromPrice!,
          psf: u.sizeSqft ? Math.round(u.fromPrice! / u.sizeSqft.min) : null,
          left: leftText(u.unitsLeft),
          estimate: false,
        })),
    ),
  ].sort((a, b) =>
    sort === "price" ? a.price - b.price : sort === "size" ? (b.size?.max ?? 0) - (a.size?.max ?? 0) : (a.psf ?? Infinity) - (b.psf ?? Infinity),
  );
  const anyEstimate = rows.some((r) => r.estimate);
  const asAt = alternatives[0].provenance.updated;
  const pill = (on: boolean) => `rounded-full px-4 py-2 font-display-normal text-sm font-semibold ${on ? "bg-canopy text-mist" : "border border-canopy/20 bg-paper text-canopy/80"}`;

  return (
    <div className="grid grid-cols-1 gap-8 [&>*]:min-w-0">
      {selected && (
        <section aria-labelledby="alt-vs-unit" className={`${card} p-5 sm:p-6`}>
          <h3 id="alt-vs-unit" className="font-display text-lg font-extrabold">
            Compared with {selected.label}
          </h3>
          <p className="mt-1 text-[0.9375rem] text-canopy/80">
            {selected.type.type}, {selected.type.sizeSqft.toLocaleString("en-SG")} sq ft, from {sgd(selected.type.fromPrice)} in this type
            {selected.type.isEstimate ? " (an estimate)" : ""}. The closest size at each alternative:
          </p>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {alternatives.map((a) => {
              const match = closestBySize(selected.type, a.unitTypes);
              const sentence = match ? sizePriceSentence(selected.type, match) : null;
              return (
                <li key={a.name} className="rounded-lg bg-mist px-4 py-3 text-sm">
                  <p className="font-display-normal font-semibold">{a.name}</p>
                  {match && sentence ? (
                    <p className="mt-0.5 text-canopy/85">
                      {match.type}, {sizeText(match.sizeSqft)} sq ft, from {sgd(match.fromPrice!)}. {sentence}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-canopy/70">No {selected.type.bedrooms}-bedroom units listed.</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="alt-by-bedroom">
        <h3 id="alt-by-bedroom" className="font-display text-xl font-extrabold">Same bedroom type, different projects</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Bedroom type">
          {bedroomOptions.map((b) => (
            <button key={b} type="button" aria-pressed={bedrooms === b} onClick={() => setBedrooms(b)} className={pill(bedrooms === b)}>
              {b} bedroom{b > 1 ? "s" : ""}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Sort by">
          <span className="font-display-normal font-semibold text-canopy/70">Sort by</span>
          {([
            ["price", "Lowest price"],
            ["size", "Largest size"],
            ["psf", "Lowest price per sq ft"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={sort === id} onClick={() => setSort(id)} className={`rounded-lg px-3 py-1.5 font-display-normal font-semibold ${sort === id ? "bg-canopy text-mist" : "bg-mist text-canopy/80"}`}>
              {label}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-canopy/25 px-4 py-3 text-sm text-canopy/75">No {bedrooms}-bedroom units listed in this comparison.</p>
        ) : (
          <>
            {/* Phone: cards */}
            <ul className="mt-4 grid gap-2 md:hidden">
              {rows.map((r) => (
                <li key={r.key} className={`rounded-xl border p-4 ${r.own ? "border-canopy/30 bg-mist" : "border-canopy/10 bg-paper"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display-normal font-semibold">{r.project}</p>
                      <p className="text-sm text-canopy/75">{r.type}</p>
                    </div>
                    <p className="shrink-0 text-right font-display-normal font-semibold tabular-nums">{sgdM(r.price)}</p>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums text-canopy/75">
                    <span>{sizeText(r.size)} sq ft</span>
                    {r.psf !== null && <span>S${r.psf.toLocaleString("en-SG")} psf</span>}
                    <span>{r.left}</span>
                    {r.estimate && <EstimateTag />}
                  </p>
                </li>
              ))}
            </ul>
            {/* Larger screens: table */}
            <div className="relative mt-4 hidden overflow-x-auto rounded-xl border border-canopy/10 md:block">
              <table className="w-full border-collapse bg-paper font-display-normal text-sm tabular-nums">
                <caption className="sr-only">{bedrooms}-bedroom units by project, with size, starting price, price per sq ft and units left</caption>
                <thead>
                  <tr className="bg-canopy text-left text-xs uppercase tracking-[0.06em] text-mist">
                    <th scope="col" className="px-4 py-3 font-semibold">Project</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Unit type</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Size (sq ft)</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">From</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Per sq ft</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Units left</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className={`border-t border-canopy/10 ${r.own ? "bg-mist" : ""}`}>
                      <th scope="row" className="px-4 py-3 text-left font-semibold">{r.project}</th>
                      <td className="px-4 py-3 text-canopy/80">{r.type}</td>
                      <td className="px-4 py-3 text-right">{sizeText(r.size)}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        <span className="inline-flex items-center gap-2">
                          {r.estimate && <EstimateTag />}
                          {sgdM(r.price)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{r.psf !== null ? `S$${r.psf.toLocaleString("en-SG")}` : "—"}</td>
                      <td className={`px-4 py-3 ${r.left.startsWith("Only") ? "font-semibold text-[#9b3b1c]" : ""}`}>{r.left}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="mt-3 text-xs text-stone">
          Other projects: lowest price among the units still available, as at {asAt}. Availability changes daily.
          {anyEstimate ? ` ${projectName}: estimated starting price for each type, from this site's illustrative pricing (not the developer's price list).` : ""} Units may differ in layout,
          facing, floor, tenure, location and specifications.
        </p>
      </section>

      <section aria-labelledby="alt-projects">
        <h3 id="alt-projects" className="font-display text-xl font-extrabold">The alternatives</h3>
        <p className="mt-1 text-[0.9375rem] text-canopy/75">Each plays a different role. None is the best for everyone: it depends on what matters to you.</p>
        <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {alternatives.map((a) => {
            const byBed = [...new Set(a.unitTypes.map((u) => u.bedrooms))].sort((x, y) => x - y).map((b) => ({
              b,
              from: Math.min(...a.unitTypes.filter((u) => u.bedrooms === b && u.fromPrice !== null).map((u) => u.fromPrice!)),
            }));
            return (
              <li key={a.name} className={`${card} flex flex-col overflow-hidden`}>
                {a.image && (
                  <figure className="relative">
                    <AssetImg src={a.image.src} alt={a.image.alt} loading="lazy" className="aspect-[16/10] w-full object-cover" />
                    <figcaption className="absolute bottom-2 right-2 rounded bg-black/55 px-2 py-0.5 text-[0.6875rem] text-white">Artist&apos;s impression</figcaption>
                  </figure>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <p className="font-display-normal text-xs font-semibold uppercase tracking-[0.1em] text-[#9b3b1c]">{a.tag}</p>
                  <h4 className="mt-1 font-display text-lg font-extrabold">{a.name}</h4>
                  <p className="mt-1 text-sm text-canopy/80">{a.why}</p>
                  <dl className="mt-3 grid gap-1 font-display-normal text-sm">
                    {[
                      ["Nearest MRT", a.nearestMrt],
                      ["Units", a.totalUnits?.toLocaleString("en-SG") ?? null],
                      ["Tenure", a.tenure],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3">
                        <dt className="text-canopy/65">{k}</dt>
                        <dd className="text-right">{v ?? "Not stated"}</dd>
                      </div>
                    ))}
                  </dl>
                  <dl className="mt-3 grid gap-1 border-t border-canopy/10 pt-3 font-display-normal text-sm">
                    {byBed.map(({ b, from }) => (
                      <div key={b} className="flex justify-between gap-3">
                        <dt className="text-canopy/65">{b} bedroom{b > 1 ? "s" : ""}</dt>
                        <dd className="font-semibold tabular-nums">from {sgdM(from)}</dd>
                      </div>
                    ))}
                  </dl>
                  {a.bestFor && <p className="mt-3 text-sm italic text-canopy/80">Best for: {a.bestFor}</p>}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-stone">
          Source: {alternatives[0].provenance.source}, {asAt}. {alternatives[0].provenance.note}
        </p>
      </section>
    </div>
  );
}
