"use client";

// The new launches map, styled like the property maps buyers know: postal
// districts shaded by average price per sq ft, "New launch" and "Upcoming"
// pins that gather into numbered bubbles when zoomed out, and a "Price by
// type" card for each project. The map of Singapore (URA subzones grouped
// into postal districts, LTA's MRT stations) is embedded, so it works where
// outside map tiles can't load. Beside it: each project's unit types, nearby
// projects to compare, and sales, rents and growth (CAGR) around it.

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart, ChartCard } from "@/features/selector/components/charts";
import { card, Disclosure, NumbersDisclaimer } from "@/features/selector/components/ui";
import { SG_VIEWBOX, sgPlanningAreas, sgStations } from "../data/sg-basemap";
import { DISTRICTS_NOTE, sgDistricts } from "../data/sg-districts";
import { projectDistrict, toXY } from "../geo";
import type { MapKind, Nearby } from "../lib";
import { bandColour, bedroomRange, cluster, districtPsf, fromPrice, km, latestPsf, located, mapKind, money, pct, priceByBedroom, projectCagr, psfBands, recommendNearby, within } from "../lib";
import type { Catalogue, CatalogueProject, MarketData, MarketProject } from "../model";

const KIND: Record<MapKind, { label: string; fill: string; ink: string; tag: string }> = {
  new: { label: "New launch", fill: "#ffffff", ink: "#16284a", tag: "NEW" },
  upcoming: { label: "Upcoming", fill: "#c99a2e", ink: "#ffffff", tag: "SOON" },
};
const WATER = "#a9dcef";
const NO_DATA = "#eceee8";
const MARKET_COLOUR = "#7a4fb5";
const NEARBY_KM = 3;
const MARKET_KM = 1.5;
const CLUSTER_PX = 54;
const BUDGETS = [1_500_000, 2_000_000, 2_500_000, 3_000_000, 4_000_000, 5_000_000, 6_000_000];

const distance = (d: number) => (d < 1 ? `${Math.round(d * 100) * 10} m` : `${d.toFixed(1)} km`);
const short = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : money(n));
const SALE_TYPE = { new: "New sale", sub: "Sub-sale", resale: "Resale", other: "Other" } as const;

interface View {
  cx: number;
  cy: number;
  /** Width shown, metres. */
  w: number;
}
const FULL: View = { cx: SG_VIEWBOX[0] + SG_VIEWBOX[2] / 2, cy: SG_VIEWBOX[1] + SG_VIEWBOX[3] / 2, w: SG_VIEWBOX[2] * 0.92 };
const MIN_W = 1200;
const MAX_W = SG_VIEWBOX[2] * 1.2;
const clampW = (w: number) => Math.max(MIN_W, Math.min(MAX_W, w));

function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width || 800, h: e.contentRect.height || 560 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** A map pin drawn in screen pixels, its tip at (0, 0): a building in a circle, with a tag. */
function Pin({ kind, selected }: { kind: MapKind; selected: boolean }) {
  const k = KIND[kind];
  const s = selected ? 1.25 : 1;
  return (
    <g transform={`scale(${s})`}>
      <path d="M0 0 C-3 -7 -13 -13 -13 -24 A13 13 0 1 1 13 -24 C13 -13 3 -7 0 0 Z" fill={k.fill} stroke={kind === "new" ? "#16284a" : "#8a6416"} strokeWidth={1.4} />
      <rect x={-6} y={-32} width={12} height={10} rx={1} fill={k.ink} />
      <rect x={-4} y={-30} width={2.4} height={2.2} fill={k.fill} />
      <rect x={1.6} y={-30} width={2.4} height={2.2} fill={k.fill} />
      <rect x={-4} y={-26.4} width={2.4} height={2.2} fill={k.fill} />
      <rect x={1.6} y={-26.4} width={2.4} height={2.2} fill={k.fill} />
      <text y={-15.5} textAnchor="middle" fontSize={5.6} fontWeight={800} fill={k.ink} fontFamily="var(--font-archivo), sans-serif" letterSpacing={0.3}>
        {k.tag}
      </text>
    </g>
  );
}

export function ProjectsMap({
  catalogue,
  market,
  marketLoaded,
  projectLink,
}: {
  catalogue: Catalogue;
  market: MarketData;
  /** False until URA's figures have been loaded; only report evidence is shown. */
  marketLoaded: boolean;
  /** A link to the project's own guide, where one exists. */
  projectLink?: (p: CatalogueProject) => string | null;
}) {
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [q, setQ] = useState("");
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [kind, setKind] = useState<MapKind | "all">("all");
  const [showStations, setShowStations] = useState(true);
  const [view, setView] = useState<View>(FULL);
  const [boxRef, size] = useSize();
  const panelRef = useRef<HTMLDivElement>(null);

  const projects = catalogue.projects;
  const shown = useMemo(
    () =>
      projects.filter((p) => {
        if (q && !`${p.name} ${p.address ?? ""} ${p.area ?? ""} ${projectDistrict(p) ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
        if (bedrooms && !p.unitTypes.some((t) => t.bedrooms === bedrooms)) return false;
        if (budget) {
          const f = fromPrice(p, bedrooms);
          if (f === null || f > budget) return false;
        }
        if (kind !== "all" && mapKind(p, today) !== kind) return false;
        return true;
      }),
    [projects, q, bedrooms, budget, kind, today],
  );
  const selected = projects.find((p) => p.id === selectedId) ?? null;
  const allBedrooms = useMemo(() => [...new Set(projects.flatMap(bedroomRange))].sort((a, b) => a - b), [projects]);
  const shading = useMemo(() => districtPsf(projects, market, projectDistrict), [projects, market]);
  const bands = useMemo(() => psfBands([...shading.values.values()].map((v) => v.avgPsf)), [shading]);

  // Map geometry: keep the shown area's shape the same as the box's.
  const h = view.w * (size.h / size.w);
  const vb = [view.cx - view.w / 2, view.cy - h / 2, view.w, h];
  const mPerPx = view.w / size.w;
  const select = (p: CatalogueProject, zoom = true) => {
    setSelectedId(p.id);
    setCardOpen(true);
    if (zoom && located(p)) {
      const { x, y } = toXY(p.lat, p.lon);
      setView((v) => ({ cx: x, cy: y, w: Math.min(v.w, 6000) }));
    }
  };
  const zoomBy = (k: number) => setView((v) => ({ ...v, w: clampW(v.w * k) }));

  // Drag to pan, wheel or pinch to zoom.
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; view: View; dist?: number; moved: boolean } | null>(null);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setView((v) => {
        const hh = v.w * (r.height / r.width);
        const at = { x: v.cx - v.w / 2 + ((e.clientX - r.left) / r.width) * v.w, y: v.cy - hh / 2 + ((e.clientY - r.top) / r.height) * hh };
        const w = clampW(v.w * (e.deltaY > 0 ? 1.18 : 1 / 1.18));
        return { cx: at.x + (v.cx - at.x) * (w / v.w), cy: at.y + (v.cy - at.y) * (w / v.w), w };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Pins, gathered into numbered bubbles where they would overlap.
  const points = shown.filter(located).map((p) => ({ p, ...toXY(p.lat!, p.lon!) }));
  const groups = view.w < 2500 ? points.map((pt) => ({ items: [pt], x: pt.x, y: pt.y })) : cluster(points, CLUSTER_PX * mPerPx);

  const nearbyMarket: Nearby<MarketProject>[] = selected && located(selected) ? within(selected, market.projects, MARKET_KM) : [];
  const recs = selected ? recommendNearby(selected, projects, today, NEARBY_KM) : [];
  const nearestStation =
    selected && located(selected) ? sgStations.map(([name, lat, lon]) => ({ name, d: km(selected, { lat, lon }) })).sort((a, b) => a.d - b.d)[0] : null;
  const priceRows = selected ? priceByBedroom(selected) : [];
  const field = "w-full min-w-0 rounded-lg border border-canopy/25 bg-paper px-3 py-2 font-display-normal text-sm";
  const basisNote =
    shading.basis === "ura"
      ? `URA sales, ${market.districtPeriod ?? "last 12 months"}`
      : shading.basis === "new-launch"
        ? "Available units at the new launches on this map"
        : "Loads with the daily update";

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-8">
      <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">New launches map</h1>
      <p className="mt-3 max-w-[70ch] text-lg text-canopy/80">
        Every new launch and upcoming project in the Huttons New Launch API, with prices by unit type, the nearby projects worth comparing, and what
        homes around each have sold and rented for.
      </p>
      <p className="mt-2 font-display-normal text-sm text-stone">
        Projects and prices: {catalogue.source}, {catalogue.fetched}.
        {catalogue.seed && " Showing the projects already loaded for Thomson Reserve; the full list loads with the first daily update."}
      </p>

      {/* Filters */}
      <div className="mt-6 grid grid-cols-1 gap-3 rounded-xl bg-mist p-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
        <label className="grid gap-1 font-display-normal text-sm">
          <span className="text-canopy/70">Search</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Project, street or district" className={field} />
        </label>
        <label className="grid gap-1 font-display-normal text-sm">
          <span className="text-canopy/70">Bedrooms</span>
          <select value={bedrooms ?? ""} onChange={(e) => setBedrooms(e.target.value ? Number(e.target.value) : null)} className={field}>
            <option value="">Any</option>
            {allBedrooms.map((b) => (
              <option key={b} value={b}>
                {b} bedrooms
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 font-display-normal text-sm">
          <span className="text-canopy/70">Budget</span>
          <select value={budget ?? ""} onChange={(e) => setBudget(e.target.value ? Number(e.target.value) : null)} className={field}>
            <option value="">Any</option>
            {BUDGETS.map((b) => (
              <option key={b} value={b}>
                Up to {short(b)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 font-display-normal text-sm">
          <span className="text-canopy/70">Show</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as MapKind | "all")} className={field}>
            <option value="all">New launches and upcoming</option>
            <option value="new">New launches</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </label>
      </div>
      <p className="mt-2 font-display-normal text-sm text-canopy/75" aria-live="polite">
        {shown.length} of {projects.length} projects match.
      </p>

      <div className="mt-4 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px] [&>*]:min-w-0">
        {/* Map */}
        <div className={`${card} overflow-hidden`}>
          <div ref={boxRef} className="relative h-[480px] touch-none select-none sm:h-[620px]" role="region" aria-label="Map of Singapore's postal districts with each project. Drag to move, scroll or pinch to zoom. The list below the map has every project.">
            <svg
              ref={svgRef}
              viewBox={vb.join(" ")}
              preserveAspectRatio="none"
              className="block h-full w-full cursor-grab active:cursor-grabbing"
              style={{ background: WATER }}
              onPointerDown={(e) => {
                (e.target as Element).setPointerCapture?.(e.pointerId);
                pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
                const pts = [...pointers.current.values()];
                drag.current = { x: e.clientX, y: e.clientY, view, moved: false, dist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : undefined };
              }}
              onPointerMove={(e) => {
                if (!drag.current || !pointers.current.has(e.pointerId)) return;
                pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
                const pts = [...pointers.current.values()];
                const d = drag.current;
                if (pts.length === 2 && d.dist) {
                  const now = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                  setView({ ...d.view, w: clampW(d.view.w * (d.dist / now)) });
                  d.moved = true;
                  return;
                }
                const r = svgRef.current!.getBoundingClientRect();
                const dx = ((e.clientX - d.x) / r.width) * d.view.w;
                const dy = ((e.clientY - d.y) / r.height) * d.view.w * (r.height / r.width);
                if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 4) d.moved = true;
                setView({ ...d.view, cx: d.view.cx - dx, cy: d.view.cy - dy });
              }}
              onPointerUp={(e) => {
                pointers.current.delete(e.pointerId);
                if (pointers.current.size === 0) setTimeout(() => (drag.current = null), 0);
              }}
              onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
            >
              {/* Land (islands outside the districts) */}
              {sgPlanningAreas.map((a) => (
                <path key={a.name} d={a.d} fill="#f2f0e6" stroke="none" />
              ))}
              {/* Postal districts, shaded by average price per sq ft */}
              {sgDistricts.map((d) => {
                const v = shading.values.get(d.id);
                return (
                  <path key={d.id} d={d.d} fill={v ? bandColour(v.avgPsf, bands)! : NO_DATA} stroke="#ffffff" strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round">
                    <title>{`${d.id} ${d.name}${v ? `: average ${money(v.avgPsf)} psf` : ""}`}</title>
                  </path>
                );
              })}
              {sgDistricts.map((d) => (
                <text
                  key={`l-${d.id}`}
                  x={d.label[0]}
                  y={d.label[1]}
                  textAnchor="middle"
                  fontSize={15 * mPerPx}
                  fontWeight={800}
                  fill="#111c14"
                  stroke="#ffffff"
                  strokeOpacity={0.55}
                  strokeWidth={2.5 * mPerPx}
                  paintOrder="stroke"
                  pointerEvents="none"
                  fontFamily="var(--font-archivo), sans-serif"
                >
                  {d.id}
                </text>
              ))}
              {showStations &&
                view.w < 16000 &&
                sgStations.map(([name, lat, lon]) => {
                  const { x, y } = toXY(lat, lon);
                  return (
                    <g key={name} pointerEvents="none" transform={`translate(${x} ${y}) scale(${mPerPx})`}>
                      <rect x={-3} y={-3} width={6} height={6} rx={1} fill="#fff" stroke="#16284a" strokeWidth={1.3} />
                      {view.w < 7000 && (
                        <text x={6} y={4} fontSize={10.5} fill="#2f3b33" stroke="#fff" strokeWidth={2.5} paintOrder="stroke" fontFamily="var(--font-archivo), sans-serif">
                          {name}
                        </text>
                      )}
                    </g>
                  );
                })}
              {selected && located(selected) && (() => {
                const { x, y } = toXY(selected.lat, selected.lon);
                return (
                  <circle cx={x} cy={y} r={NEARBY_KM * 1000} fill="#16284a" fillOpacity={0.05} stroke="#16284a" strokeOpacity={0.45} strokeDasharray={`${6 * mPerPx} ${5 * mPerPx}`} strokeWidth={1.3 * mPerPx} pointerEvents="none" />
                );
              })()}
              {/* Pins and numbered bubbles */}
              {groups.map((g) => {
                if (g.items.length > 1) {
                  const r = (g.items.length > 99 ? 21 : 18) * mPerPx;
                  return (
                    <g
                      key={`c-${g.items[0].p.id}`}
                      role="button"
                      aria-label={`${g.items.length} projects here. Zoom in`}
                      className="cursor-pointer"
                      onClick={() => {
                        if (drag.current?.moved) return;
                        const xs = g.items.map((i) => i.x);
                        const ys = g.items.map((i) => i.y);
                        const spread = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * (size.w / size.h));
                        setView({ cx: g.x, cy: g.y, w: clampW(Math.max(spread * 2.2, view.w / 3)) });
                      }}
                    >
                      <circle cx={g.x} cy={g.y + 1.5 * mPerPx} r={r} fill="#000" opacity={0.12} />
                      <circle cx={g.x} cy={g.y} r={r} fill="#ffffff" />
                      <text x={g.x} y={g.y + 5.5 * mPerPx} textAnchor="middle" fontSize={15 * mPerPx} fontWeight={700} fill="#111c14" fontFamily="var(--font-archivo), sans-serif">
                        {g.items.length}
                      </text>
                    </g>
                  );
                }
                const { p, x, y } = g.items[0];
                const on = p.id === selectedId;
                return (
                  <g
                    key={p.id}
                    role="button"
                    aria-label={`${p.name}, ${KIND[mapKind(p, today)].label}`}
                    className="cursor-pointer"
                    transform={`translate(${x} ${y}) scale(${mPerPx})`}
                    onClick={() => {
                      if (!drag.current?.moved) select(p, false);
                    }}
                  >
                    <Pin kind={mapKind(p, today)} selected={on} />
                    {(on || view.w < 5000) && (
                      <text x={15} y={-22} fontSize={on ? 12.5 : 11} fontWeight={700} fill="#111c14" stroke="#fff" strokeWidth={3} paintOrder="stroke" fontFamily="var(--font-archivo), sans-serif">
                        {p.name}
                      </text>
                    )}
                    <title>{p.name}</title>
                  </g>
                );
              })}
            </svg>

            {/* Zoom */}
            <div className="absolute right-3 top-3 grid gap-1.5">
              <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1 / 1.6)} className="grid size-10 place-items-center rounded-full bg-paper font-display text-xl font-bold shadow-md">
                +
              </button>
              <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1.6)} className="grid size-10 place-items-center rounded-full bg-paper font-display text-xl font-bold shadow-md">
                −
              </button>
              <button type="button" onClick={() => setView(FULL)} className="rounded-full bg-paper px-2 py-1.5 font-display-normal text-xs font-semibold shadow-md">
                All
              </button>
            </div>

            {/* Legend */}
            <div className="absolute bottom-3 right-3 w-[13.5rem] rounded-xl bg-paper/95 p-3 font-display-normal text-[12px] shadow-md max-sm:hidden">
              {(Object.keys(KIND) as MapKind[]).map((k) => (
                <p key={k} className="flex items-center gap-2 py-0.5 text-[13px] font-semibold text-[#16284a]">
                  <svg viewBox="-14 -38 28 40" className="h-5 w-4" aria-hidden="true">
                    <Pin kind={k} selected={false} />
                  </svg>
                  {KIND[k].label}
                </p>
              ))}
              <p className="mt-2 border-t border-canopy/10 pt-2 text-center text-[13px] font-semibold text-[#16284a]">Avg. PSF</p>
              {bands.length ? (
                <ul className="mt-1 grid gap-0.5">
                  {bands.map((b) => (
                    <li key={b.colour} className="flex items-center gap-2 tabular-nums">
                      <span aria-hidden="true" className="size-3 rounded-sm border border-black/10" style={{ background: b.colour }} />
                      S$ {b.from.toLocaleString("en-SG")} – S$ {b.to.toLocaleString("en-SG")}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-1 text-[11px] leading-snug text-stone">{basisNote}</p>
            </div>

            {/* Price by type card */}
            {selected && cardOpen && (
              <div className="absolute inset-x-3 top-3 z-10 mx-auto max-h-[calc(100%-1.5rem)] max-w-[34rem] overflow-y-auto rounded-2xl bg-paper shadow-xl sm:top-6">
                <div className="flex items-center justify-between gap-3 bg-[#16284a] px-4 py-3 text-white">
                  <p className="font-display-normal text-base font-semibold">Price by type (available)</p>
                  <button type="button" onClick={() => setCardOpen(false)} aria-label="Close" className="grid size-8 place-items-center rounded-full text-xl hover:bg-white/10">
                    ×
                  </button>
                </div>
                <div className="p-4">
                  <p className="flex flex-wrap items-center gap-2 font-display-normal text-base font-bold">
                    {selected.name}
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: KIND[mapKind(selected, today)].fill, color: KIND[mapKind(selected, today)].ink, boxShadow: "inset 0 0 0 1px #16284a33" }}>
                      {KIND[mapKind(selected, today)].label}
                    </span>
                  </p>
                  {priceRows.length ? (
                    <div className="mt-3 overflow-x-auto rounded-xl border border-canopy/10">
                      <table className="w-full border-collapse whitespace-nowrap font-display-normal text-[13px] tabular-nums sm:text-sm">
                        <thead>
                          <tr className="text-left text-xs text-canopy/70">
                            <th scope="col" className="px-3 py-2 font-semibold">Bedroom</th>
                            <th scope="col" className="px-2 py-2 text-right font-semibold">Lo PSF</th>
                            <th scope="col" className="px-2 py-2 text-right font-semibold">Hi PSF</th>
                            <th scope="col" className="px-2 py-2 text-right font-semibold">Lo Price</th>
                            <th scope="col" className="px-3 py-2 text-right font-semibold">Hi Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {priceRows.map((r) => (
                            <tr key={r.bedrooms} className="border-t border-canopy/10">
                              <th scope="row" className="px-3 py-2 text-left font-medium">
                                {r.bedrooms} <span className="max-sm:hidden">Bedroom</span>
                                <span className="sm:hidden">BR</span>
                              </th>
                              <td className="px-2 py-2 text-right">{r.loPsf !== null ? money(r.loPsf) : "—"}</td>
                              <td className="px-2 py-2 text-right">{r.hiPsf !== null ? money(r.hiPsf) : "—"}</td>
                              <td className="px-2 py-2 text-right">{r.loPrice !== null ? money(r.loPrice) : "—"}</td>
                              <td className="px-3 py-2 text-right">{r.hiPrice !== null ? money(r.hiPrice) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-canopy/75">No units on sale in the API yet.</p>
                  )}
                  {priceRows.length > 0 && priceRows.every((r) => r.loPrice === null) && <p className="mt-2 text-xs text-stone">Prices aren&apos;t released yet.</p>}
                  {priceRows.some((r) => r.loPrice !== null && r.loPsf === null) && (
                    <p className="mt-2 text-xs text-stone">Price per sq ft and highest prices fill in with the daily update.</p>
                  )}
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCardOpen(false);
                        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className="rounded-full bg-[#c99a2e] px-5 py-2 font-display-normal text-sm font-semibold text-white hover:bg-[#b5891f]"
                    >
                      Project details
                    </button>
                    {projectLink?.(selected) && (
                      <a href={projectLink(selected)!} target="_blank" rel="noopener" className="rounded-full bg-[#c99a2e] px-5 py-2 font-display-normal text-sm font-semibold text-white hover:bg-[#b5891f]">
                        Open the guide
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-paper/85 px-2 py-1 font-display-normal text-[11px] text-canopy/80">
              {(() => {
                const kmBar = view.w > 20000 ? 5 : view.w > 8000 ? 2 : view.w > 4000 ? 1 : 0.5;
                return (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-1 bg-canopy" style={{ width: `${(kmBar * 1000) / mPerPx}px` }} />
                    {kmBar < 1 ? `${kmBar * 1000} m` : `${kmBar} km`}
                  </span>
                );
              })()}
            </div>
          </div>
          {/* Phone legend and options */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-canopy/10 px-4 py-3 font-display-normal text-sm text-canopy/80">
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:hidden">
              {(Object.keys(KIND) as MapKind[]).map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <svg viewBox="-14 -38 28 40" className="h-5 w-4" aria-hidden="true">
                    <Pin kind={k} selected={false} />
                  </svg>
                  {KIND[k].label}
                </span>
              ))}
              {bands.length > 0 && (
                <span className="flex items-center gap-1 tabular-nums">
                  Avg. PSF S$ {bands[0].from.toLocaleString("en-SG")}
                  {bands.map((b) => (
                    <span key={b.colour} aria-hidden="true" className="h-3 w-3" style={{ background: b.colour }} />
                  ))}
                  S$ {bands[bands.length - 1].to.toLocaleString("en-SG")}
                </span>
              )}
            </span>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={showStations} onChange={(e) => setShowStations(e.target.checked)} />
              <span aria-hidden="true" className="size-2.5 border border-[#16284a] bg-white" />
              MRT and LRT stations
            </label>
          </div>
          <p className="border-t border-canopy/10 bg-mist px-4 py-2 text-xs text-stone">
            Map: URA Master Plan 2019 subzones and planning areas, LTA station exits (data.gov.sg); addresses from OneMap. {DISTRICTS_NOTE} Shading: {basisNote.toLowerCase()}.
          </p>
        </div>

        {/* Selected project */}
        <div ref={panelRef} className="scroll-mt-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
          {selected ? (
            <ProjectPanel
              p={selected}
              today={today}
              station={nearestStation}
              recs={recs}
              nearbyMarket={nearbyMarket}
              market={market}
              marketLoaded={marketLoaded}
              link={projectLink?.(selected) ?? null}
              onSelect={(p) => select(p)}
            />
          ) : (
            <div className={`${card} p-5`}>
              <p className="font-display-normal font-semibold">Choose a project on the map or in the list.</p>
              <p className="mt-1 text-sm text-canopy/75">
                You&apos;ll see its prices by unit type, nearby projects to compare, and sales, rents and growth of the homes around it.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* List */}
      <section aria-labelledby="list-title" className="mt-10">
        <h2 id="list-title" className="font-display text-xl font-extrabold">All matching projects</h2>
        <div className={`${card} mt-3 overflow-x-auto`}>
          <table className="w-full border-collapse font-display-normal text-sm tabular-nums">
            <thead>
              <tr className="bg-mist text-left text-xs uppercase tracking-[0.06em] text-canopy/70">
                <th scope="col" className="px-3 py-2.5 font-semibold">Project</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">District</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Bedrooms</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">From</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Units left</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Type</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const k = mapKind(p, today);
                const f = fromPrice(p, bedrooms);
                return (
                  <tr key={p.id} className={`border-t border-canopy/10 ${p.id === selectedId ? "bg-[#eef1f7]" : ""}`}>
                    <th scope="row" className="px-3 py-2 text-left">
                      <button type="button" onClick={() => select(p)} className="font-semibold text-reservoir underline underline-offset-2">
                        {p.name}
                      </button>
                    </th>
                    <td className="px-3 py-2 text-canopy/80">{projectDistrict(p) ?? "—"}</td>
                    <td className="px-3 py-2">{bedroomRange(p).join(", ") || "—"}</td>
                    <td className="px-3 py-2 text-right">{f !== null ? short(f) : "—"}</td>
                    <td className="px-3 py-2 text-right">{p.unitsLeft?.toLocaleString("en-SG") ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <span aria-hidden="true" className="size-2.5 rounded-full border border-[#16284a]" style={{ background: KIND[k].fill }} />
                        {KIND[k].label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <NumbersDisclaimer className="mt-10" />
    </div>
  );
}

function ProjectPanel({
  p,
  today,
  station,
  recs,
  nearbyMarket,
  market,
  marketLoaded,
  link,
  onSelect,
}: {
  p: CatalogueProject;
  today: string;
  station: { name: string; d: number } | null;
  recs: ReturnType<typeof recommendNearby>;
  nearbyMarket: Nearby<MarketProject>[];
  market: MarketData;
  marketLoaded: boolean;
  link: string | null;
  onSelect: (p: CatalogueProject) => void;
}) {
  const s = { label: KIND[mapKind(p, today)].label, colour: mapKind(p, today) === "upcoming" ? "#a77a14" : "#16284a" };
  const withCagr = nearbyMarket.map((n) => ({ ...n, cagr: projectCagr(n.item), latest: latestPsf(n.item) }));
  const facts = [
    ["Address", p.address],
    ["District", [projectDistrict(p), p.area].filter(Boolean).join(" · ") || null],
    ["Market segment", p.segment],
    ["Tenure", p.tenure],
    ["Developer", p.developer],
    ["Launch", p.launchDate ?? p.launchNote],
    ["Completion (expected)", p.completionDate],
    ["Units", p.totalUnits ? `${p.unitsLeft?.toLocaleString("en-SG") ?? "—"} left of ${p.totalUnits.toLocaleString("en-SG")}` : null],
    ["Nearest MRT", station ? `${station.name}, about ${distance(station.d)} away` : null],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="grid grid-cols-1 gap-4 [&>*]:min-w-0">
      <section className={`${card} p-5`} aria-labelledby="panel-title">
        <p className="flex items-center gap-1.5 font-display-normal text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: s.colour }}>
          <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: s.colour }} />
          {s.label}
        </p>
        <h2 id="panel-title" className="mt-1 font-display text-2xl font-extrabold leading-tight">{p.name}</h2>
        <dl className="mt-3 grid gap-1.5 font-display-normal text-sm">
          {facts.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[8.5rem_1fr] gap-2">
              <dt className="text-canopy/65">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {link && (
          <a href={link} target="_blank" rel="noopener" className="mt-4 inline-block rounded-full bg-canopy px-5 py-2.5 font-display-normal text-sm font-semibold text-mist">
            Open the {p.name} guide
          </a>
        )}
      </section>

      <section className={`${card} p-5`} aria-labelledby="types-title">
        <h3 id="types-title" className="font-display text-lg font-extrabold">Unit types and prices</h3>
        {p.unitTypes.length ? (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse font-display-normal text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-canopy/65">
                  <th scope="col" className="py-1.5 pr-2 font-semibold">Type</th>
                  <th scope="col" className="py-1.5 pr-2 text-right font-semibold">Sq ft</th>
                  <th scope="col" className="py-1.5 pr-2 text-right font-semibold">From</th>
                  <th scope="col" className="py-1.5 text-right font-semibold">Left</th>
                </tr>
              </thead>
              <tbody>
                {p.unitTypes.map((t) => (
                  <tr key={t.type} className="border-t border-canopy/10">
                    <th scope="row" className="py-1.5 pr-2 text-left font-semibold">{t.type}</th>
                    <td className="py-1.5 pr-2 text-right">{t.sizeSqft ? (t.sizeSqft.min === t.sizeSqft.max ? t.sizeSqft.min : `${t.sizeSqft.min}–${t.sizeSqft.max}`) : "—"}</td>
                    <td className="py-1.5 pr-2 text-right">
                      {t.fromPrice !== null ? short(t.fromPrice) : "—"}
                      {t.fromPsf !== null && <span className="block text-xs text-stone">{money(t.fromPsf)} psf</span>}
                    </td>
                    <td className="py-1.5 text-right">{t.unitsLeft ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {p.unitTypes.every((t) => t.fromPrice === null) && <p className="mt-2 text-xs text-stone">Prices aren&apos;t released yet.</p>}
          </div>
        ) : (
          <p className="mt-1 text-sm text-canopy/75">No unit list in the API yet.</p>
        )}
      </section>

      <section className={`${card} p-5`} aria-labelledby="recs-title">
        <h3 id="recs-title" className="font-display text-lg font-extrabold">Nearby projects to compare</h3>
        <p className="mt-0.5 text-sm text-canopy/75">Within {NEARBY_KM} km, still selling, with a bedroom type in common. Prices update daily.</p>
        {recs.length ? (
          <ul className="mt-2 grid gap-2">
            {recs.map((r) => (
              <li key={r.item.id}>
                <button type="button" onClick={() => onSelect(r.item)} className="w-full rounded-lg border border-canopy/15 px-3 py-2 text-left hover:bg-mist">
                  <span className="block font-display-normal font-semibold">{r.item.name}</span>
                  <span className="block text-sm text-canopy/75">{r.reason}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-canopy/75">No other projects on the map within {NEARBY_KM} km.</p>
        )}
      </section>

      <section className={`${card} p-5`} aria-labelledby="market-title">
        <h3 id="market-title" className="font-display text-lg font-extrabold">Sales, rents and growth nearby</h3>
        <p className="mt-0.5 text-sm text-canopy/75">Private homes within {MARKET_KM} km with sales or rents on record.</p>
        {!marketLoaded && (
          <p className="mt-2 rounded-lg bg-[#fbf5e6] px-3 py-2 text-xs text-[#5c3f0b]">
            URA&apos;s sales and rents load with the daily update once a URA access key is set. Until then only developments with a report already in
            hand are shown (JadeScape).
          </p>
        )}
        {withCagr.length ? (
          <>
            {withCagr.some((n) => n.cagr) && (
              <div className="mt-3">
                <ChartCard title="Yearly growth (CAGR)" subtitle="Matched resales where a report gives them; otherwise the trend of the median price per sq ft">
                  <BarChart
                    ariaLabel="Yearly growth of nearby developments"
                    format={(n) => pct(n)}
                    bars={withCagr
                      .filter((n) => n.cagr)
                      .slice(0, 8)
                      .map((n, i) => ({ id: `${n.item.name}-${i}`, label: n.item.name, sub: distance(n.km), value: n.cagr!.rate, color: MARKET_COLOUR }))}
                  />
                </ChartCard>
              </div>
            )}
            <ul className="mt-3 grid gap-2">
              {withCagr.map((n) => (
                <li key={`${n.item.name}-${n.item.street}`}>
                  <Disclosure
                    title={`${n.item.name} · ${distance(n.km)}`}
                    hint={[
                      n.cagr ? `CAGR ${pct(n.cagr.rate)}` : null,
                      n.latest ? `${n.latest.year} median ${money(n.latest.medianPsf)} psf` : null,
                      n.item.rentals.filter((r) => r.bedrooms).slice(0, 3).map((r) => `${r.bedrooms}BR ${money(r.medianRent)}/mo`).join(", ") || null,
                    ].filter(Boolean).join(" · ")}
                  >
                    <MarketDetail m={n.item} cagr={n.cagr} market={market} />
                  </Disclosure>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-sm text-canopy/75">None on record within {MARKET_KM} km yet.</p>
        )}
      </section>
    </div>
  );
}

function MarketDetail({ m, cagr, market }: { m: MarketProject; cagr: ReturnType<typeof projectCagr>; market: MarketData }) {
  const th = "py-1.5 pr-2 font-semibold";
  return (
    <div className="grid grid-cols-1 gap-4 font-display-normal text-sm [&>*]:min-w-0">
      {cagr && (
        <p>
          <strong>CAGR {pct(cagr.rate)} a year.</strong> <span className="text-canopy/75">{cagr.note}</span>
        </p>
      )}
      {m.sales.length > 0 && (
        <div className="overflow-x-auto">
          <p className="mb-1 font-semibold">Sales by year</p>
          <table className="w-full border-collapse tabular-nums">
            <thead>
              <tr className="text-left text-xs text-canopy/65">
                <th scope="col" className={th}>Year</th>
                <th scope="col" className={`${th} text-right`}>Sales</th>
                <th scope="col" className={`${th} text-right`}>Median psf</th>
                <th scope="col" className={`${th} text-right`}>New / sub / resale</th>
              </tr>
            </thead>
            <tbody>
              {m.sales.map((y) => (
                <tr key={y.year} className="border-t border-canopy/10">
                  <th scope="row" className="py-1.5 pr-2 text-left">{y.year}</th>
                  <td className="py-1.5 pr-2 text-right">{y.count}</td>
                  <td className="py-1.5 pr-2 text-right">{money(y.medianPsf)}</td>
                  <td className="py-1.5 text-right">
                    {y.newSale} / {y.subSale} / {y.resale}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {m.rentals.length > 0 && (
        <div className="overflow-x-auto">
          <p className="mb-1 font-semibold">Rents{market.rentalPeriod && !m.source ? `, ${market.rentalPeriod}` : ""}</p>
          <table className="w-full border-collapse tabular-nums">
            <thead>
              <tr className="text-left text-xs text-canopy/65">
                <th scope="col" className={th}>Bedrooms</th>
                <th scope="col" className={`${th} text-right`}>Leases</th>
                <th scope="col" className={`${th} text-right`}>Median rent</th>
                <th scope="col" className={`${th} text-right`}>Per sq ft</th>
              </tr>
            </thead>
            <tbody>
              {m.rentals.map((r) => (
                <tr key={String(r.bedrooms)} className="border-t border-canopy/10">
                  <th scope="row" className="py-1.5 pr-2 text-left">{r.bedrooms ?? "Not stated"}</th>
                  <td className="py-1.5 pr-2 text-right">{r.count}</td>
                  <td className="py-1.5 pr-2 text-right">{money(r.medianRent)}</td>
                  <td className="py-1.5 text-right">{r.medianPsf !== null ? `$${r.medianPsf.toFixed(2)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {m.recentSales.length > 0 && (
        <div className="overflow-x-auto">
          <p className="mb-1 font-semibold">Recent sales</p>
          <table className="w-full border-collapse tabular-nums">
            <thead>
              <tr className="text-left text-xs text-canopy/65">
                <th scope="col" className={th}>Month</th>
                <th scope="col" className={th}>Type</th>
                <th scope="col" className={th}>Floor</th>
                <th scope="col" className={`${th} text-right`}>Sq ft</th>
                <th scope="col" className={`${th} text-right`}>Price</th>
                <th scope="col" className={`${th} text-right`}>Psf</th>
              </tr>
            </thead>
            <tbody>
              {m.recentSales.slice(0, 15).map((r, i) => (
                <tr key={i} className="border-t border-canopy/10">
                  <td className="py-1.5 pr-2">{r[0]}</td>
                  <td className="py-1.5 pr-2">{SALE_TYPE[r[1]]}</td>
                  <td className="py-1.5 pr-2">{r[2] ?? "—"}</td>
                  <td className="py-1.5 pr-2 text-right">{r[3].toLocaleString("en-SG")}</td>
                  <td className="py-1.5 pr-2 text-right">{short(r[4])}</td>
                  <td className="py-1.5 text-right">{money(r[5])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-stone">
        Source: {m.source ?? `${market.source}, ${market.fetched}`}. Medians mix floors, sizes and sale types; a guide, not a valuation.
      </p>
    </div>
  );
}
