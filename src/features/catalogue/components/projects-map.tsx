"use client";

// The Huttons projects map: every project from the Huttons New Launch API on
// a light map of Singapore (planning areas and MRT stations, embedded so it
// works anywhere), with filters, each project's unit types and prices, the
// nearby projects worth comparing, and sales, rents and growth (CAGR) of the
// private homes around it.

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart, ChartCard } from "@/features/selector/components/charts";
import { card, Disclosure, NumbersDisclaimer } from "@/features/selector/components/ui";
import { PROJECTION, SG_VIEWBOX, sgPlanningAreas, sgStations } from "../data/sg-basemap";
import type { Nearby } from "../lib";
import { bedroomRange, fromPrice, km, latestPsf, located, money, pct, projectCagr, projectStatus, recommendNearby, within } from "../lib";
import type { ProjectStatus } from "../lib";
import type { Catalogue, CatalogueProject, MarketData, MarketProject } from "../model";

const toXY = (lat: number, lon: number) => ({
  x: (lon - PROJECTION.lon0) * PROJECTION.metresPerDegree * Math.cos((PROJECTION.lat0 * Math.PI) / 180),
  y: (PROJECTION.lat0 - lat) * PROJECTION.metresPerDegree,
});

const STATUS: Record<ProjectStatus, { label: string; colour: string }> = {
  selling: { label: "Selling", colour: "#0b7f9e" },
  upcoming: { label: "Launching soon", colour: "#c77a12" },
  "sold-out": { label: "Sold out", colour: "#8a948b" },
  unknown: { label: "Availability not known", colour: "#5f6b62" },
};
const MARKET_COLOUR = "#7a4fb5";
const NEARBY_KM = 3;
const MARKET_KM = 1.5;
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
const FULL: View = { cx: SG_VIEWBOX[0] + SG_VIEWBOX[2] / 2, cy: SG_VIEWBOX[1] + SG_VIEWBOX[3] / 2, w: SG_VIEWBOX[2] };

function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 520 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width || 800, h: e.contentRect.height || 520 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
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
  const [q, setQ] = useState("");
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [status, setStatus] = useState<ProjectStatus | "all">("all");
  const [showMarket, setShowMarket] = useState(true);
  const [showStations, setShowStations] = useState(true);
  const [view, setView] = useState<View>(FULL);
  const [boxRef, size] = useSize();

  const projects = catalogue.projects;
  const shown = useMemo(
    () =>
      projects.filter((p) => {
        if (q && !`${p.name} ${p.address ?? ""} ${p.area ?? ""} ${p.district ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
        if (bedrooms && !p.unitTypes.some((t) => t.bedrooms === bedrooms)) return false;
        if (budget) {
          const f = fromPrice(p, bedrooms);
          if (f === null || f > budget) return false;
        }
        if (status !== "all" && projectStatus(p, today) !== status) return false;
        return true;
      }),
    [projects, q, bedrooms, budget, status, today],
  );
  const selected = projects.find((p) => p.id === selectedId) ?? null;
  const allBedrooms = useMemo(() => [...new Set(projects.flatMap(bedroomRange))].sort((a, b) => a - b), [projects]);

  // Map geometry: keep the shown area's shape the same as the box's.
  const h = view.w * (size.h / size.w);
  const vb = [view.cx - view.w / 2, view.cy - h / 2, view.w, h];
  const mPerPx = view.w / size.w;
  const focus = (lat: number, lon: number, w = 7000) => {
    const { x, y } = toXY(lat, lon);
    setView({ cx: x, cy: y, w });
  };
  const select = (p: CatalogueProject, zoom = true) => {
    setSelectedId(p.id);
    if (zoom && located(p)) focus(p.lat, p.lon, Math.min(view.w, 7000));
  };
  const zoomBy = (k: number, at?: { x: number; y: number }) =>
    setView((v) => {
      const w = Math.max(1500, Math.min(FULL.w * 1.2, v.w * k));
      if (!at) return { ...v, w };
      return { cx: at.x + (v.cx - at.x) * (w / v.w), cy: at.y + (v.cy - at.y) * (w / v.w), w };
    });

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
        const w = Math.max(1500, Math.min(FULL.w * 1.2, v.w * (e.deltaY > 0 ? 1.18 : 1 / 1.18)));
        return { cx: at.x + (v.cx - at.x) * (w / v.w), cy: at.y + (v.cy - at.y) * (w / v.w), w };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const nearbyMarket: Nearby<MarketProject>[] = selected && located(selected) ? within(selected, market.projects, MARKET_KM) : [];
  const recs = selected ? recommendNearby(selected, projects, today, NEARBY_KM) : [];
  const nearestStation = selected && located(selected)
    ? sgStations.map(([name, lat, lon]) => ({ name, d: km(selected, { lat, lon }) })).sort((a, b) => a.d - b.d)[0]
    : null;

  const markerR = 7 * mPerPx;
  const labelAll = view.w < 9000;
  const field = "w-full min-w-0 rounded-lg border border-canopy/25 bg-paper px-3 py-2 font-display-normal text-sm";

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-8">
      <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">New launches map</h1>
      <p className="mt-3 max-w-[70ch] text-lg text-canopy/80">
        Every project in the Huttons New Launch API, with what each still has for sale, the nearby projects worth comparing, and what homes around it
        have sold and rented for.
      </p>
      <p className="mt-2 font-display-normal text-sm text-stone">
        Projects and prices: {catalogue.source}, {catalogue.fetched}.
        {catalogue.seed && " Showing the projects already loaded for Thomson Reserve; the full list loads with the first daily update."}
      </p>

      {/* Filters */}
      <div className="mt-6 grid grid-cols-1 gap-3 rounded-xl bg-mist p-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
        <label className="grid gap-1 font-display-normal text-sm">
          <span className="text-canopy/70">Search</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Project, street or area" className={field} />
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
          <span className="text-canopy/70">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus | "all")} className={field}>
            <option value="all">All</option>
            {(Object.keys(STATUS) as ProjectStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS[s].label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-2 font-display-normal text-sm text-canopy/75" aria-live="polite">
        {shown.length} of {projects.length} projects match.
      </p>

      <div className="mt-4 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px] [&>*]:min-w-0">
        {/* Map */}
        <div className={`${card} overflow-hidden`}>
          <div ref={boxRef} className="relative h-[440px] touch-none select-none sm:h-[560px]" role="region" aria-label="Map of Singapore with each project. Drag to move, scroll or pinch to zoom. The list below the map has every project.">
            <svg
              ref={svgRef}
              viewBox={vb.join(" ")}
              preserveAspectRatio="none"
              className="block h-full w-full cursor-grab bg-[#dfeef2] active:cursor-grabbing"
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
                  setView({ ...d.view, w: Math.max(1500, Math.min(FULL.w * 1.2, d.view.w * (d.dist / now))) });
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
              <g>
                {sgPlanningAreas.map((a) => (
                  <path key={a.name} d={a.d} fill="#f4f6f1" stroke="#c9d3c6" strokeWidth={1} vectorEffect="non-scaling-stroke">
                    <title>{a.name}</title>
                  </path>
                ))}
              </g>
              {showStations &&
                sgStations.map(([name, lat, lon]) => {
                  const { x, y } = toXY(lat, lon);
                  return (
                    <g key={name} pointerEvents="none">
                      <rect x={x - 2.6 * mPerPx} y={y - 2.6 * mPerPx} width={5.2 * mPerPx} height={5.2 * mPerPx} fill="#fff" stroke="#10291c" strokeWidth={1.2 * mPerPx} />
                      {view.w < 6000 && (
                        <text x={x + 5 * mPerPx} y={y + 3.5 * mPerPx} fontSize={10 * mPerPx} fill="#3d4a41" fontFamily="var(--font-archivo), sans-serif">
                          {name}
                        </text>
                      )}
                    </g>
                  );
                })}
              {showMarket &&
                market.projects.map((m) => {
                  const { x, y } = toXY(m.lat, m.lon);
                  return (
                    <rect key={`${m.name}-${m.street}`} x={x - 3.5 * mPerPx} y={y - 3.5 * mPerPx} width={7 * mPerPx} height={7 * mPerPx} fill={MARKET_COLOUR} opacity={0.75} transform={`rotate(45 ${x} ${y})`}>
                      <title>{`${m.name}: sales and rents on record`}</title>
                    </rect>
                  );
                })}
              {selected && located(selected) && (() => {
                const { x, y } = toXY(selected.lat, selected.lon);
                return (
                  <g pointerEvents="none">
                    <circle cx={x} cy={y} r={NEARBY_KM * 1000} fill="#0b7f9e" opacity={0.05} stroke="#0b7f9e" strokeOpacity={0.4} strokeDasharray={`${6 * mPerPx} ${5 * mPerPx}`} strokeWidth={1.2 * mPerPx} />
                    <circle cx={x} cy={y} r={MARKET_KM * 1000} fill="none" stroke={MARKET_COLOUR} strokeOpacity={0.45} strokeDasharray={`${4 * mPerPx} ${4 * mPerPx}`} strokeWidth={1.2 * mPerPx} />
                  </g>
                );
              })()}
              {shown.filter(located).map((p) => {
                const { x, y } = toXY(p.lat!, p.lon!);
                const s = STATUS[projectStatus(p, today)];
                const on = p.id === selectedId;
                return (
                  <g
                    key={p.id}
                    role="button"
                    tabIndex={-1}
                    aria-label={p.name}
                    className="cursor-pointer"
                    onClick={() => {
                      if (!drag.current?.moved) select(p, false);
                    }}
                  >
                    <circle cx={x} cy={y} r={markerR * (on ? 1.45 : 1)} fill={s.colour} stroke="#fff" strokeWidth={2 * mPerPx} />
                    {on && <circle cx={x} cy={y} r={markerR * 2.2} fill="none" stroke={s.colour} strokeWidth={2 * mPerPx} />}
                    {(labelAll || on) && (
                      <text
                        x={x + markerR * 1.6}
                        y={y + 4 * mPerPx}
                        fontSize={(on ? 13 : 11.5) * mPerPx}
                        fontWeight={on ? 700 : 600}
                        fill="#10291c"
                        stroke="#fff"
                        strokeWidth={3 * mPerPx}
                        paintOrder="stroke"
                        fontFamily="var(--font-archivo), sans-serif"
                      >
                        {p.name}
                      </text>
                    )}
                    <title>{p.name}</title>
                  </g>
                );
              })}
            </svg>
            <div className="absolute right-3 top-3 grid gap-1.5">
              {[
                ["+", "Zoom in", () => zoomBy(1 / 1.6)],
                ["−", "Zoom out", () => zoomBy(1.6)],
              ].map(([t, label, fn]) => (
                <button key={label as string} type="button" aria-label={label as string} onClick={fn as () => void} className="grid size-10 place-items-center rounded-full bg-paper font-display text-xl font-bold shadow-md">
                  {t as string}
                </button>
              ))}
              <button type="button" onClick={() => setView(FULL)} className="rounded-full bg-paper px-2 py-1.5 font-display-normal text-xs font-semibold shadow-md">
                All
              </button>
            </div>
            <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-paper/85 px-2 py-1 font-display-normal text-[11px] text-canopy/80">
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-canopy/10 px-4 py-3 font-display-normal text-sm text-canopy/80">
            {(Object.keys(STATUS) as ProjectStatus[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-3 rounded-full" style={{ background: STATUS[s].colour }} />
                {STATUS[s].label}
              </span>
            ))}
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={showMarket} onChange={(e) => setShowMarket(e.target.checked)} />
              <span aria-hidden="true" className="size-2.5 rotate-45" style={{ background: MARKET_COLOUR }} />
              Homes with sales and rents
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={showStations} onChange={(e) => setShowStations(e.target.checked)} />
              <span aria-hidden="true" className="size-2.5 border border-canopy bg-white" />
              MRT and LRT stations
            </label>
          </div>
          <p className="border-t border-canopy/10 bg-mist px-4 py-2 text-xs text-stone">
            Map: URA Master Plan 2019 planning areas and LTA station exits (data.gov.sg). Project positions from the Huttons New Launch API or OneMap.
          </p>
        </div>

        {/* Selected project */}
        <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
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
                You&apos;ll see its unit types and prices, nearby projects to compare, and sales, rents and growth of the homes around it.
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
                <th scope="col" className="px-3 py-2.5 font-semibold">Area</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Bedrooms</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">From</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Units left</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const s = projectStatus(p, today);
                const f = fromPrice(p, bedrooms);
                return (
                  <tr key={p.id} className={`border-t border-canopy/10 ${p.id === selectedId ? "bg-[#e7f3f6]" : ""}`}>
                    <th scope="row" className="px-3 py-2 text-left">
                      <button type="button" onClick={() => select(p)} className="font-semibold text-reservoir underline underline-offset-2">
                        {p.name}
                      </button>
                    </th>
                    <td className="px-3 py-2 text-canopy/80">{[p.district, p.area ?? p.address].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="px-3 py-2">{bedroomRange(p).join(", ") || "—"}</td>
                    <td className="px-3 py-2 text-right">{f !== null ? short(f) : "—"}</td>
                    <td className="px-3 py-2 text-right">{p.unitsLeft?.toLocaleString("en-SG") ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: STATUS[s].colour }} />
                        {STATUS[s].label}
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
  const s = STATUS[projectStatus(p, today)];
  const withCagr = nearbyMarket.map((n) => ({ ...n, cagr: projectCagr(n.item), latest: latestPsf(n.item) }));
  const facts = [
    ["Address", p.address],
    ["District", [p.district, p.area].filter(Boolean).join(" · ") || null],
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
