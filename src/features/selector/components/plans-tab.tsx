"use client";

// Plans tab: every floor plan, an elevation chart of unit types by stack and
// level (coloured like the developer's), and the site plan, in one place.

import { useMemo, useRef, useState } from "react";
import type { DatasetIndex } from "../lib/dataset-index";
import type { Unit } from "../model/types";
import { AssetImg } from "./asset-image";
import { NotSupplied } from "./tabs";
import { BEDROOM_COLOURS, btnText, card } from "./ui";
import { unitNumber } from "./unit-summary";
import { isPesType } from "../lib/format";

const NO_HOME = "#eef0ec";

/** Dark text on light colours, white on dark ones. */
function inkFor(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.32 ? "#10291c" : "#ffffff";
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString("en-SG")}`;
}

interface PlanGroup {
  src: string;
  /** Stacks built as a mirror image of the plan shown. */
  mirrored: string[];
  credit: string;
  codes: string[];
  category: string;
  bedrooms: number | null;
  areaSqft: number | null;
  stacks: string[];
  units: number;
}

export function PlansTab({
  ix,
  units,
  selectedUnit,
  onSelectUnit,
  onViewUnit,
}: {
  ix: DatasetIndex;
  /** Units with prices applied (real or estimated). */
  units: Unit[];
  selectedUnit: Unit | null;
  onSelectUnit: (u: Unit) => void;
  onViewUnit: () => void;
}) {
  const ds = ix.ds;
  const typeColours = ds.project.display?.unitTypeColours;
  const colourFor = (layout: { category?: string; bedrooms: number | null }) => {
    const typed = typeColours?.find((t) => t.category === layout.category)?.colour;
    return typed ?? (layout.bedrooms === null ? "#d9ded6" : BEDROOM_COLOURS[layout.bedrooms] ?? "#cccccc");
  };
  const categoryOrder = (c: string) => {
    const i = typeColours?.findIndex((t) => t.category === c) ?? -1;
    return i < 0 ? 99 : i;
  };

  // Floor plans: one card per plan image, with the unit types and stacks that use it.
  const plans = useMemo(() => {
    const byImage = new Map<string, PlanGroup>();
    for (const u of units) {
      if (!u.floorPlan) continue;
      const layout = ix.unitLayout(u);
      const key = u.floorPlan.src;
      const g =
        byImage.get(key) ??
        ({
          src: u.floorPlan.src,
          mirrored: [],
          credit: u.floorPlan.credit,
          codes: [],
          category: layout.category ?? layout.name,
          bedrooms: layout.bedrooms,
          areaSqft: layout.areaSqft,
          stacks: [],
          units: 0,
        } satisfies PlanGroup);
      const code = u.typeCode ?? layout.name;
      if (!g.codes.includes(code)) g.codes.push(code);
      if (!g.stacks.includes(u.stackId)) g.stacks.push(u.stackId);
      if (u.floorPlan.mirrored && !g.mirrored.includes(u.stackId)) g.mirrored.push(u.stackId);
      g.units += 1;
      byImage.set(key, g);
    }
    return [...byImage.values()]
      .map((g) => ({ ...g, codes: g.codes.sort(), stacks: g.stacks.sort((a, b) => a.localeCompare(b, "en", { numeric: true })) }))
      .sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category) || (a.areaSqft ?? 0) - (b.areaSqft ?? 0) || a.codes[0].localeCompare(b.codes[0], "en", { numeric: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- categoryOrder only reads typeColours
  }, [units, ix, typeColours]);

  const bedroomOptions = useMemo(
    () => [...new Set(plans.map((p) => p.bedrooms).filter((b): b is number => b !== null))].sort(),
    [plans],
  );
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const shownPlans = bedrooms === null ? plans : plans.filter((p) => p.bedrooms === bedrooms);

  // Elevation chart, one block at a time.
  const blocks = ds.blocks;
  const [blockId, setBlockId] = useState(() => (selectedUnit ? ix.stackBlock(selectedUnit.stackId).id : blocks[0]?.id));
  const block = blocks.find((b) => b.id === blockId) ?? blocks[0];
  const chart = useMemo(() => {
    if (!block) return null;
    const stacks = ds.stacks
      .filter((s) => s.blockId === block.id)
      .map((s) => s.id)
      .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
    const byKey = new Map(units.filter((u) => stacks.includes(u.stackId)).map((u) => [`${u.stackId}|${u.level}`, u]));
    const levels = Array.from({ length: block.storeys }, (_, i) => block.storeys - i);
    return { stacks, byKey, levels };
  }, [block, ds.stacks, units]);
  const legend = useMemo(() => {
    const cats = [...new Set(ds.layouts.map((l) => l.category ?? l.name))];
    return cats
      .sort((a, b) => categoryOrder(a) - categoryOrder(b))
      .map((c) => {
        const layout = ds.layouts.find((l) => (l.category ?? l.name) === c);
        return { label: c, colour: layout ? colourFor(layout) : "#cccccc" };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- colourFor and categoryOrder only read ix and typeColours
  }, [ds, ix, typeColours]);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<PlanGroup | null>(null);
  const showPlan = (p: PlanGroup) => {
    setOpen(p);
    dialogRef.current?.showModal();
  };

  const planImage = ds.project.display?.planImage;
  const pill = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 font-display-normal text-sm font-medium ${active ? "border-canopy bg-canopy text-mist" : "border-canopy/25 text-canopy/80 hover:bg-mist"}`;

  return (
    <div className="grid grid-cols-1 gap-14 [&>*]:min-w-0">
      <nav aria-label="On this tab" className="-mt-2 flex flex-wrap gap-2 font-display-normal text-sm">
        <a href="#floor-plans" className={pill(false)}>Floor plans</a>
        <a href="#elevation" className={pill(false)}>Elevation chart</a>
        <a href="#site-plan-image" className={pill(false)}>Site plan</a>
      </nav>

      {/* Floor plans */}
      <section id="floor-plans" aria-labelledby="plans-title" className="scroll-mt-24">
        <h3 id="plans-title" className="font-display text-xl font-extrabold">Floor plans</h3>
        {plans.length === 0 ? (
          <div className="mt-3">
            <NotSupplied title="Floor plans have not been added for this project." needed={["The developer's unit plans, one image per unit type."]} />
          </div>
        ) : (
          <>
            <p className="mt-1 max-w-[72ch] text-canopy/75">
              {plans.length} plans covering every unit type. Tap a plan to enlarge it.
              {plans.some((g) => g.codes.some((c) => isPesType(c))) &&
                " Types ending in \u201cp\u201d are the same layout on the lowest residential level, with a private enclosed space."}
            </p>
            {bedroomOptions.length > 1 && (
              <div role="group" aria-label="Show plans for" className="mt-4 flex flex-wrap gap-2">
                <button type="button" aria-pressed={bedrooms === null} onClick={() => setBedrooms(null)} className={pill(bedrooms === null)}>
                  All
                </button>
                {bedroomOptions.map((b) => (
                  <button key={b} type="button" aria-pressed={bedrooms === b} onClick={() => setBedrooms(b)} className={pill(bedrooms === b)}>
                    {b} bedrooms
                  </button>
                ))}
              </div>
            )}
            <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {shownPlans.map((p) => {
                const colour = colourFor(p);
                return (
                  <li key={p.src} className="min-w-0">
                    <button type="button" onClick={() => showPlan(p)} className={`${card} block w-full overflow-hidden text-left hover:border-canopy/30`}>
                      <span className="block bg-white p-2">
                        <AssetImg
                          src={p.src}
                          alt={`Floor plan, type ${p.codes.join(", ")}`}
                          loading="lazy"
                          className="mx-auto block aspect-[4/3] w-full object-contain"
                        />
                      </span>
                      <span className="block border-t border-canopy/10 p-3 font-display-normal">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-canopy/70">
                          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ background: colour }} />
                          <span className="truncate">{p.category}</span>
                        </span>
                        <span className="mt-0.5 block text-[0.9375rem] font-semibold leading-snug">Type {p.codes.join(" · ")}</span>
                        <span className="block text-sm text-canopy/75">
                          {p.areaSqft ? `${p.areaSqft.toLocaleString("en-SG")} sq ft · ` : ""}
                          {p.units} {p.units === 1 ? "unit" : "units"}
                        </span>
                        <span className="block text-xs text-stone">
                          Stack{p.stacks.length > 1 ? "s" : ""} {p.stacks.join(", ")}
                          {p.mirrored.length > 0 ? ` (${p.mirrored.join(", ")} mirrored)` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 font-display-normal text-xs text-stone">{plans[0]?.credit}</p>
          </>
        )}
      </section>

      {/* Elevation chart */}
      <section id="elevation" aria-labelledby="elevation-title" className="scroll-mt-24">
        <h3 id="elevation-title" className="font-display text-xl font-extrabold">Elevation chart</h3>
        <p className="mt-1 max-w-[72ch] text-canopy/75">
          Every unit in a block, by stack and level, coloured by unit type. A stack is a column of units directly above one another, with the same layout and
          facing. Tap a unit to select it.
        </p>
        {block && chart ? (
          <>
            <div role="group" aria-label="Block" className="mt-4 flex flex-wrap gap-2">
              {blocks.map((b) => (
                <button key={b.id} type="button" aria-pressed={b.id === block.id} onClick={() => setBlockId(b.id)} className={pill(b.id === block.id)}>
                  {b.name}
                  {b.collection ? <span className="ml-1 font-normal opacity-75">· {b.collection}</span> : null}
                </button>
              ))}
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 font-display-normal text-sm text-canopy/80" aria-label="Colour key">
              {legend.map((l) => (
                <li key={l.label} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-3 rounded-sm border border-canopy/10" style={{ background: l.colour }} />
                  {l.label}
                </li>
              ))}
            </ul>
            <div className={`${card} mt-4 overflow-x-auto p-3`}>
              <table className="border-separate border-spacing-[2px] font-display-normal text-[11px]">
                <caption className="sr-only">
                  Unit types in {block.name} by stack and level
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 bg-paper px-1.5 text-left text-canopy/60">Level</th>
                    {chart.stacks.map((s) => (
                      <th key={s} scope="col" className="min-w-[46px] px-1 pb-1 text-center font-semibold text-canopy">
                        #{s}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chart.levels.map((level) => (
                    <tr key={level}>
                      <th scope="row" className="sticky left-0 z-10 bg-paper px-1.5 text-left font-semibold tabular-nums text-canopy/70">
                        {level}
                      </th>
                      {chart.stacks.map((s) => {
                        const u = chart.byKey.get(`${s}|${level}`);
                        if (!u) return <td key={s} aria-label="No unit" className="h-[22px] rounded-sm" style={{ background: NO_HOME }} />;
                        const layout = ix.unitLayout(u);
                        const bg = colourFor(layout);
                        const selected = selectedUnit?.id === u.id;
                        const label = `Unit ${unitNumber(u)}, type ${u.typeCode ?? layout.name}, ${layout.category ?? ""}${layout.areaSqft ? `, ${layout.areaSqft.toLocaleString("en-SG")} sq ft` : ""}${u.price !== null ? `, ${u.priceIsEstimate ? "est. " : ""}${money(u.price)}` : ""}`;
                        return (
                          <td key={s} className="p-0">
                            <button
                              type="button"
                              onClick={() => onSelectUnit(u)}
                              aria-label={label}
                              aria-pressed={selected}
                              title={label}
                              className={`block h-[22px] w-full rounded-sm px-1 text-center font-semibold leading-[22px] ${selected ? "outline outline-2 outline-offset-1 outline-[#c62f2f]" : ""}`}
                              style={{ background: bg, color: inkFor(bg) }}
                            >
                              {u.typeCode ?? ""}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedUnit && (
              <p className="mt-3 font-display-normal text-sm">
                Unit {unitNumber(selectedUnit)} selected.{" "}
                <button type="button" onClick={onViewUnit} className={btnText}>
                  See its details and payments →
                </button>
              </p>
            )}
            {ds.project.display?.unitTypeColoursCredit && <p className="mt-2 font-display-normal text-xs text-stone">{ds.project.display.unitTypeColoursCredit}</p>}
          </>
        ) : (
          <div className="mt-3">
            <NotSupplied title="The unit schedule has not been added for this project." needed={["The developer's elevation charts: unit type for every stack and level."]} />
          </div>
        )}
      </section>

      {/* Site plan */}
      <section id="site-plan-image" aria-labelledby="siteplan-title" className="scroll-mt-24">
        <h3 id="siteplan-title" className="font-display text-xl font-extrabold">Site plan</h3>
        {planImage ? (
          <figure className={`${card} mt-3 overflow-hidden`}>
            <AssetImg src={planImage.src} alt={`${ds.project.name} site plan, showing the blocks, stacks and facilities`} loading="lazy" className="block h-auto w-full bg-white" />
            <figcaption className="border-t border-canopy/10 px-4 py-2.5 font-display-normal text-xs text-stone">{planImage.credit}</figcaption>
          </figure>
        ) : (
          <div className="mt-3">
            <NotSupplied title="The site plan has not been added for this project." needed={["The developer's site plan, with its scale bar and north point."]} />
          </div>
        )}
      </section>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
        aria-label={open ? `Floor plan, type ${open.codes.join(", ")}` : "Floor plan"}
        className="m-auto max-h-[92vh] w-[min(1100px,94vw)] rounded-xl bg-paper p-0 backdrop:bg-[#0b1d14]/70"
      >
        {open && (
          <div className="grid">
            <div className="flex items-start justify-between gap-3 border-b border-canopy/10 px-4 py-3 font-display-normal">
              <div>
                <p className="text-base font-semibold">Type {open.codes.join(" · ")}</p>
                <p className="text-sm text-canopy/75">
                  {open.category}
                  {open.areaSqft ? ` · ${open.areaSqft.toLocaleString("en-SG")} sq ft` : ""} · Stack{open.stacks.length > 1 ? "s" : ""} {open.stacks.join(", ")}
                  {open.mirrored.length > 0 ? `. Stack${open.mirrored.length > 1 ? "s" : ""} ${open.mirrored.join(", ")} ${open.mirrored.length > 1 ? "are" : "is"} a mirror image.` : ""}
                </p>
              </div>
              <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-full border border-canopy/25 px-4 py-1.5 text-sm font-semibold">
                Close
              </button>
            </div>
            <div className="overflow-auto bg-white p-3">
              <AssetImg
                src={open.src}
                alt={`Floor plan, type ${open.codes.join(", ")}`}
                className="mx-auto block h-auto max-h-[78vh] w-auto max-w-full"
              />
            </div>
            <p className="border-t border-canopy/10 px-4 py-2 font-display-normal text-xs text-stone">{open.credit}</p>
          </div>
        )}
      </dialog>
    </div>
  );
}
