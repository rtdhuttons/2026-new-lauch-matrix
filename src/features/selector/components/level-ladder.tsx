"use client";

import { useMemo, useState } from "react";
import { levelImage } from "../data";
import type { Dataset } from "../model/types";
import type { PriceEstimate } from "../lib/estimate";
import { estimatedPsf, lowestHomeLevel } from "../lib/estimate";
import { BEDROOM_COLOURS } from "./ui";
import { AssetImg } from "./asset-image";

interface LevelRow {
  level: number;
  psf: number;
  homes: number;
  collections: string[];
  types: { key: string; name: string; bedrooms: number | null; areaSqft: number; homes: number; price: number }[];
}

// Sequential ramp in the reservoir hue: low floors light, high floors dark.
const LIGHT = [185, 214, 221];
const DARK = [23, 63, 72];
const ramp = (t: number) =>
  `rgb(${LIGHT.map((c, i) => Math.round(c + (DARK[i] - c) * t)).join(",")})`;

const money = (n: number) => `$${Math.round(n).toLocaleString("en-SG")}`;
const millions = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;

function levelRows(ds: Dataset, e: PriceEstimate): LevelRow[] {
  const baseLevel = lowestHomeLevel(ds);
  const top = Math.max(...ds.blocks.map((b) => b.storeys));
  const layoutOf = new Map(ds.stacks.map((s) => [s.id, ds.layouts.find((l) => l.id === s.layoutId)!]));
  const collectionOf = new Map(ds.stacks.map((s) => [s.id, ds.blocks.find((b) => b.id === s.blockId)?.collection ?? ""]));
  const rows: LevelRow[] = [];
  for (let level = baseLevel; level <= top; level++) {
    const psf = estimatedPsf(level, e, baseLevel);
    const types = new Map<string, LevelRow["types"][number]>();
    const collections = new Set<string>();
    let homes = 0;
    for (const u of ds.units) {
      if (u.level !== level) continue;
      const l = layoutOf.get(u.stackId);
      if (!l || l.areaSqft === null) continue;
      homes += 1;
      collections.add(collectionOf.get(u.stackId) ?? "");
      const key = `${l.category}|${l.areaSqft}`;
      const t = types.get(key);
      if (t) t.homes += 1;
      else
        types.set(key, {
          key,
          name: l.category ?? l.name,
          bedrooms: l.bedrooms,
          areaSqft: l.areaSqft,
          homes: 1,
          price: Math.round((psf * l.areaSqft) / 1000) * 1000,
        });
    }
    rows.push({
      level,
      psf,
      homes,
      collections: [...collections].filter(Boolean).sort(),
      types: [...types.values()].sort((a, b) => a.areaSqft - b.areaSqft),
    });
  }
  return rows;
}

/** Levels 1–30 as a tower: PSF by floor, and what each unit type costs there. */
export function LevelLadder({ base, estimate }: { base: Dataset; estimate: PriceEstimate }) {
  const rows = useMemo(() => levelRows(base, estimate), [base, estimate]);
  const [level, setLevel] = useState(21);
  const first = rows[0];
  const last = rows[rows.length - 1];
  const sel = rows.find((r) => r.level === level) ?? last;
  const img = levelImage(sel.level);
  const classicTop = Math.max(...base.blocks.filter((b) => b.collection === "Classic").map((b) => b.storeys));
  const t = (psf: number) => (last.psf === first.psf ? 1 : (psf - first.psf) / (last.psf - first.psf));

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(220px,260px)_1fr] [&>*]:min-w-0">
      <div>
        <label htmlFor="ladder-level" className="font-display-normal text-sm font-semibold">
          Choose a level
        </label>
        <input
          id="ladder-level"
          type="range"
          min={first.level}
          max={last.level}
          value={sel.level}
          onChange={(e) => setLevel(Number(e.target.value))}
          aria-valuetext={`Level ${sel.level}, ${money(sel.psf)} psf`}
          className="mt-1 w-full accent-reservoir"
        />
        <div className="mt-3 flex flex-col-reverse gap-[2px]" role="group" aria-label="Levels">
          {rows.map((r) => {
            const active = r.level === sel.level;
            const luxuryOnly = r.level > classicTop;
            return (
              <button
                key={r.level}
                type="button"
                onClick={() => setLevel(r.level)}
                aria-pressed={active}
                aria-label={`Level ${r.level}, ${money(r.psf)} psf, ${r.homes} homes`}
                className="group grid grid-cols-[2rem_1fr_4.25rem] items-center gap-2 text-left"
              >
                <span className={`text-right font-display-normal text-[0.75rem] tabular-nums ${active ? "font-bold text-canopy" : "text-stone"}`}>
                  {r.level}
                </span>
                <span
                  className={`block h-[12px] rounded-[3px] transition-[outline] ${active ? "outline outline-2 outline-offset-1 outline-canopy" : "group-hover:outline group-hover:outline-1 group-hover:outline-canopy/40"}`}
                  style={{ background: ramp(t(r.psf)), width: luxuryOnly ? "62%" : "100%" }}
                />
                <span className={`font-display-normal text-[0.75rem] tabular-nums ${active ? "font-bold text-canopy" : "text-stone"}`}>
                  {active || r.level === first.level || r.level === last.level || r.level % 5 === 0 ? `${money(r.psf)}` : ""}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[0.8125rem] leading-snug text-canopy/75">
          Narrower bars: levels {classicTop + 1}–{last.level}, Luxury Collection only. Classic towers stop at level {classicTop}.
        </p>
      </div>

      <div className="min-w-0">
        <figure className="relative overflow-hidden rounded-xl bg-canopy">
          <AssetImg key={img.src} src={img.src} alt={img.alt} className="aspect-[16/7] w-full object-cover motion-safe:animate-[fadeIn_400ms_ease-out]" />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/20 to-transparent" />
          <figcaption className="absolute inset-y-0 left-0 flex flex-col justify-end p-4 text-white sm:p-6" aria-live="polite">
            <span className="font-display-normal text-sm font-semibold uppercase tracking-[0.14em] text-white/85">Level {sel.level}</span>
            <span className="font-display text-3xl font-extrabold tabular-nums sm:text-5xl">{money(sel.psf)} psf</span>
            <span className="mt-1 max-w-[40ch] text-sm text-white/90">{img.title}. {img.caption}</span>
          </figcaption>
          <span className="absolute bottom-2 right-3 font-display-normal text-[0.6875rem] text-white/75">Artist&apos;s impression</span>
        </figure>

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-display-normal text-base font-semibold">
            {sel.homes} homes on level {sel.level}
            <span className="font-normal text-stone"> · {sel.collections.map((c) => `${c} Collection`).join(" and ") || "none"}</span>
          </p>
          <p className="font-display-normal text-sm text-stone">
            +{money(sel.psf - first.psf)} psf over level {first.level}
          </p>
        </div>
        {sel.types.length === 0 ? (
          <p className="mt-2 text-[1rem] text-canopy/80">No homes on this level.</p>
        ) : (
          <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
            {sel.types.map((ty) => (
              <li key={ty.key} className="flex items-center justify-between gap-3 border-t border-canopy/10 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: ty.bedrooms ? BEDROOM_COLOURS[ty.bedrooms] : "#6f7a71" }} />
                  <span className="min-w-0 font-display-normal text-sm">
                    <span className="font-semibold">{ty.name}</span>
                    <span className="block text-[0.8125rem] text-stone">
                      {ty.areaSqft.toLocaleString("en-SG")} sq ft · {ty.homes} {ty.homes === 1 ? "home" : "homes"}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 font-display-normal text-base font-semibold tabular-nums">{millions(ty.price)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[0.8125rem] leading-snug text-canopy/75">
          Homes start at level {first.level} in the Luxury blocks (on six stacks per block, with private enclosed spaces). In the Classic blocks, level 1 is a car park: homes start at level 2, with private enclosed spaces, and typical floors at level 3. Source: developer&apos;s elevation charts and unit plans.
        </p>
      </div>
    </div>
  );
}
