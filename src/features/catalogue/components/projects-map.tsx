"use client";

// The new launches map, styled as a modern property search: URA's market
// regions (CCR, RCR, OCR) in three coordinated colours over a quiet base map
// of parks, water and major roads; compact navy markers for new launches,
// upcoming projects, gathering into count bubbles;
// labels that never collide; a district card on hover or tap; and a compact
// project card. A "Price heatmap" view shades postal districts by average psf
// when that data is loaded. Everything is embedded, so it works where outside
// map tiles can't load.

import { useEffect, useMemo, useRef, useState } from "react";
import { AssetImg } from "@/features/selector/components/asset-image";
import { BarChart, ChartCard } from "@/features/selector/components/charts";
import { card, Disclosure, NumbersDisclaimer } from "@/features/selector/components/ui";
import { SG_VIEWBOX, sgStations } from "../data/sg-basemap";
import { DISTRICTS_NOTE, sgDistricts } from "../data/sg-districts";
import { areaLabels, districtRegions, sgMajorRoads, sgParks, sgRegions, sgWater } from "../data/sg-layers";
import { imageFor } from "../data/images";
import { projectDistrict, projectRegion, toXY } from "../geo";
import type { LabelCandidate, MapKind, Nearby, Region } from "../lib";
import {
  bandColour,
  bedroomRange,
  cluster,
  districtPsf,
  fromPrice,
  km,
  latestPsf,
  located,
  mapKind,
  onMap,
  money,
  pct,
  placeLabels,
  priceByBedroom,
  projectCagr,
  psfBands,
  recommendNearby,
  within,
} from "../lib";
import type { Catalogue, CatalogueProject, MarketData, MarketProject } from "../model";

const REGION: Record<Region, { name: string; fill: string; accent: string }> = {
  CCR: { name: "Core Central Region", fill: "#E9DDF7", accent: "#7952B3" },
  RCR: { name: "Rest of Central Region", fill: "#FBE3CA", accent: "#B96524" },
  OCR: { name: "Outside Central Region", fill: "#D8EEE7", accent: "#247C69" },
};
const REGIONS: Region[] = ["CCR", "RCR", "OCR"];
type Kind = MapKind;
const KIND: Record<Kind, { label: string; badge: string }> = {
  new: { label: "New launch", badge: "New" },
  upcoming: { label: "Upcoming", badge: "Upcoming" },
};
const NAVY = "#14284b";
const SEA = "#EAF2F5";
const NO_DATA = "#eef0ec";
const MARKET_COLOUR = "#7a4fb5";
const NEARBY_KM = 3;
const MARKET_KM = 1.5;
const CLUSTER_PX = 48;
const OVERVIEW_M = 22000;
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
const FULL: View = { cx: SG_VIEWBOX[0] + SG_VIEWBOX[2] / 2, cy: SG_VIEWBOX[1] + SG_VIEWBOX[3] / 2, w: SG_VIEWBOX[2] * 0.95 };
/** The opening view: the whole island, or on a narrow screen the main island's middle, so it isn't tiny. */
const fullView = (width: number): View => (width < 640 ? { cx: FULL.cx + 3500, cy: FULL.cy - 1500, w: SG_VIEWBOX[2] * 0.6 } : FULL);
const MIN_W = 1200;
const MAX_W = SG_VIEWBOX[2] * 1.2;
const clampW = (w: number) => Math.max(MIN_W, Math.min(MAX_W, w));

function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width || 800, h: e.contentRect.height || 600 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** A compact navy marker in screen pixels, tip at (0, 0); the glyph tells the listing type. */
function Marker({ kind, ring }: { kind: Kind; ring?: string }) {
  return (
    <g>
      {ring && <circle cx={0} cy={-15} r={15} fill="none" stroke={ring} strokeWidth={3} />}
      <path d="M0 0 C-2.5 -5 -10 -9.5 -10 -16.5 A10 10 0 1 1 10 -16.5 C10 -9.5 2.5 -5 0 0 Z" fill={NAVY} stroke="#ffffff" strokeWidth={1.5} />
      {kind === "new" && (
        <g fill="#ffffff">
          <rect x={-4.5} y={-21} width={9} height={8.5} rx={0.8} />
          <rect x={-2.8} y={-19.4} width={1.8} height={1.6} fill={NAVY} />
          <rect x={1} y={-19.4} width={1.8} height={1.6} fill={NAVY} />
          <rect x={-2.8} y={-16.4} width={1.8} height={1.6} fill={NAVY} />
          <rect x={1} y={-16.4} width={1.8} height={1.6} fill={NAVY} />
        </g>
      )}
      {kind === "upcoming" && (
        <g fill="none" stroke="#ffffff" strokeWidth={1.6} strokeLinecap="round">
          <circle cx={0} cy={-16.5} r={5} />
          <path d="M0 -19.5 V-16.5 L2.2 -15" />
        </g>
      )}
    </g>
  );
}

type Item = { kind: MapKind; key: string; x: number; y: number; project: CatalogueProject; region: Region | null };

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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [kinds, setKinds] = useState<Record<Kind, boolean>>({ new: true, upcoming: true });
  const [region, setRegion] = useState<Region | "all">("all");
  const [mode, setMode] = useState<"regions" | "heatmap">("regions");
  const [hoverDistrict, setHoverDistrict] = useState<string | null>(null);
  const [pinnedDistrict, setPinnedDistrict] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [view, setView] = useState<View>(FULL);
  const [boxRef, size] = useSize();
  // Open on a closer view on phones, once the map's width is known.
  const [fitted, setFitted] = useState(false);
  if (!fitted && size.w !== 800) {
    setFitted(true);
    if (size.w < 640) setView(fullView(size.w));
  }
  const panelRef = useRef<HTMLDivElement>(null);

  const projects = catalogue.projects;
  const matchesFilters = (p: CatalogueProject) => {
    if (q && !`${p.name} ${p.address ?? ""} ${p.area ?? ""} ${projectDistrict(p) ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (bedrooms && !p.unitTypes.some((t) => t.bedrooms === bedrooms)) return false;
    if (budget) {
      const f = fromPrice(p, bedrooms);
      if (f === null || f > budget) return false;
    }
    if (!onMap(p, today) || !kinds[mapKind(p, today)]) return false;
    if (region !== "all" && projectRegion(p) !== region) return false;
    return true;
  };
  const shown = projects.filter(matchesFilters);
  const listed = projects.filter((p) => onMap(p, today)).length;
  const items: Item[] = [
    ...shown.filter(located).map((p) => ({ kind: mapKind(p, today), key: p.id, ...toXY(p.lat!, p.lon!), project: p, region: projectRegion(p) }) as Item),
  ];
  const selectedItem = items.find((i) => i.key === selectedKey) ?? null;
  const selected = selectedItem ? selectedItem.project : projects.find((p) => p.id === selectedKey) ?? null;
  const allBedrooms = useMemo(() => [...new Set(projects.flatMap(bedroomRange))].sort((a, b) => a - b), [projects]);
  const shading = useMemo(() => districtPsf(projects, market, projectDistrict), [projects, market]);
  const bands = useMemo(() => psfBands([...shading.values.values()].map((v) => v.avgPsf)), [shading]);
  const heatmap = mode === "heatmap" && shading.basis !== null;

  // Map geometry: keep the shown area's shape the same as the box's.
  const h = view.w * (size.h / size.w);
  const vb = [view.cx - view.w / 2, view.cy - h / 2, view.w, h];
  const mPerPx = view.w / size.w;
  const toScreen = (x: number, y: number) => ({ sx: (x - vb[0]) / mPerPx, sy: (y - vb[1]) / mPerPx });
  const fit = (bx: number, by: number, bw: number, bh: number) =>
    setView({ cx: bx + bw / 2, cy: by + bh / 2, w: clampW(Math.max(bw, bh * (size.w / size.h)) * 1.12) });
  const chooseRegion = (r: Region | "all") => {
    setRegion(r);
    setSelectedKey(null);
    if (r === "all") setView(fullView(size.w));
    else {
      const b = sgRegions.find((x) => x.id === r)!.bbox;
      fit(b[0], b[1], b[2], b[3]);
    }
  };
  const select = (key: string, zoomTo?: { x: number; y: number }) => {
    setSelectedKey(key);
    setPinnedDistrict(null);
    if (zoomTo) setView((v) => ({ cx: zoomTo.x, cy: zoomTo.y, w: Math.min(v.w, 6000) }));
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
  const wasDrag = () => !!drag.current?.moved;

  // Markers, gathered into count bubbles where they would overlap.
  const groups = view.w < 2500 ? items.map((it) => ({ items: [it], x: it.x, y: it.y })) : cluster(items, CLUSTER_PX * mPerPx);

  // Labels: regions and neighbourhoods first at the island overview, district numbers as you zoom in; none may collide.
  const overview = view.w > OVERVIEW_M;
  const candidates: (LabelCandidate & { x: number; y: number; style: "region" | "area" | "district" | "station"; colour?: string })[] = [];
  for (const r of sgRegions) {
    if (!overview) break;
    candidates.push({ key: `r-${r.id}`, text: r.id, x: r.label[0], y: r.label[1], ...toScreen(r.label[0], r.label[1]), fontPx: 15, priority: 0, style: "region", colour: REGION[r.id].accent });
  }
  areaLabels.forEach(([name, x, y], i) => {
    if (overview && i >= 16) return;
    candidates.push({ key: `a-${name}`, text: name, x, y, ...toScreen(x, y), fontPx: 11.5, priority: overview ? 1 + i / 100 : 3 + i / 100, style: "area" });
  });
  for (const d of sgDistricts) {
    candidates.push({ key: `d-${d.id}`, text: d.id, x: d.label[0], y: d.label[1], ...toScreen(d.label[0], d.label[1]), fontPx: 13, priority: overview ? 2 : 1, style: "district" });
  }
  if (view.w < 6000) {
    for (const [name, lat, lon] of sgStations) {
      const { x, y } = toXY(lat, lon);
      const s = toScreen(x, y);
      candidates.push({ key: `s-${name}`, text: name, x, y, sx: s.sx + 6 + name.length * 3.2, sy: s.sy, fontPx: 10.5, priority: 4, style: "station" });
    }
  }
  // Labels keep clear of the markers and the floating panels.
  const obstacles = [
    ...groups.map((g) => {
      const s = toScreen(g.x, g.y);
      return g.items.length > 1 ? { x0: s.sx - 17, y0: s.sy - 17, x1: s.sx + 17, y1: s.sy + 17 } : { x0: s.sx - 12, y0: s.sy - 32, x1: s.sx + 12, y1: s.sy + 2 };
    }),
    { x0: 0, y0: 0, x1: Math.min(size.w - 60, 360), y1: shading.basis !== null ? 120 : 66 },
    { x0: size.w - 64, y0: 0, x1: size.w, y1: 156 },
    ...(size.w >= 640 && !selectedItem ? [{ x0: 0, y0: size.h - 196, x1: 262, y1: size.h }] : []),
  ];
  const visibleLabels = placeLabels(candidates, size.w, size.h, 4, obstacles);

  const activeDistrict = hoverDistrict ?? pinnedDistrict;
  const districtInfo = activeDistrict ? sgDistricts.find((d) => d.id === activeDistrict) ?? null : null;
  const districtListings = activeDistrict ? shown.filter((p) => projectDistrict(p) === activeDistrict).length : 0;
  const districtAccent = (id: string) => {
    const shares = districtRegions[id] ?? {};
    const top = (Object.entries(shares) as [Region, number][]).sort((a, b) => b[1] - a[1])[0]?.[0];
    return top ? REGION[top].accent : NAVY;
  };

  const nearbyMarket: Nearby<MarketProject>[] = selected && located(selected) ? within(selected, market.projects, MARKET_KM) : [];
  const recs = selected ? recommendNearby(selected, projects, today, NEARBY_KM) : [];
  const nearestStation =
    selected && located(selected) ? sgStations.map(([name, lat, lon]) => ({ name, d: km(selected, { lat, lon }) })).sort((a, b) => a.d - b.d)[0] : null;
  const field = "w-full min-w-0 rounded-lg border border-canopy/25 bg-paper px-3 py-2.5 font-display-normal text-sm";
  const basisNote =
    shading.basis === "ura"
      ? `URA sales, ${market.districtPeriod ?? "last 12 months"}`
      : shading.basis === "new-launch"
        ? "Available units at the new launches on this map"
        : "";
  const panelBtn = "grid size-11 place-items-center text-canopy hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-[-2px]";
  const cardOpen = !!selectedItem;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-8">
      <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">New launches map</h1>
      <p className="mt-3 max-w-[70ch] text-lg text-canopy/80">
        New launches and upcoming projects across Singapore&apos;s three market regions, with prices by unit type and the nearby
        projects worth comparing.
      </p>
      <p className="mt-2 font-display-normal text-sm text-stone">
        Projects and prices: {catalogue.source}, {catalogue.fetched}.
        {catalogue.seed && " Showing the projects already loaded for Thomson Reserve; the full list loads with the daily update."}
        {projects.length > listed && ` ${projects.length - listed} sold-out projects are not shown.`}
      </p>

      {/* Search filters */}
      <div className="mt-6 grid grid-cols-1 gap-3 rounded-xl bg-mist p-4 sm:grid-cols-3 [&>*]:min-w-0">
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
        <div role="group" aria-label="Listing types" className="flex flex-wrap items-center gap-2 sm:col-span-3">
          <span className="font-display-normal text-sm text-canopy/70">Show</span>
          {(Object.keys(KIND) as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kinds[k]}
              onClick={() => setKinds((v) => ({ ...v, [k]: !v[k] }))}
              className={`flex min-h-11 items-center gap-2 rounded-full border px-3.5 font-display-normal text-sm font-medium ${kinds[k] ? "border-[#14284b] bg-white text-[#14284b]" : "border-canopy/20 bg-transparent text-canopy/55"}`}
            >
              <svg viewBox="-12 -29 24 31" className="h-5 w-4" aria-hidden="true">
                <Marker kind={k} />
              </svg>
              {KIND[k].label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 font-display-normal text-sm text-canopy/75" aria-live="polite">
        {shown.length} of {listed} projects shown
        {region !== "all" ? ` in ${REGION[region].name} (${region})` : ""}.
      </p>

      <div className="mt-4 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px] [&>*]:min-w-0">
        {/* Map */}
        <div className={`${card} overflow-hidden`}>
          <div
            ref={boxRef}
            className="relative h-[72vh] max-h-[680px] min-h-[480px] touch-none select-none"
            role="region"
            aria-label="Map of Singapore's market regions and listings. Drag to move, scroll or pinch to zoom. The list below the map has every listing."
          >
            <svg
              ref={svgRef}
              viewBox={vb.join(" ")}
              preserveAspectRatio="none"
              className="block h-full w-full cursor-grab active:cursor-grabbing"
              style={{ background: SEA }}
              onPointerDown={(e) => {
                (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
                const pts = [...pointers.current.values()];
                drag.current = { x: e.clientX, y: e.clientY, view, moved: false, dist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : undefined };
              }}
              onPointerMove={(e) => {
                if (!drag.current || !pointers.current.has(e.pointerId)) {
                  // Hover: which district is under the pointer (mouse only).
                  if (e.pointerType === "mouse") {
                    const el = document.elementFromPoint(e.clientX, e.clientY) as SVGElement | null;
                    setHoverDistrict(el?.dataset.district ?? null);
                  }
                  return;
                }
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
              onPointerLeave={() => setHoverDistrict(null)}
            >
              {/* Regions (or a neutral base under the heatmap) */}
              {sgRegions.map((r) => (
                <path
                  key={r.id}
                  d={r.d}
                  fillRule="evenodd"
                  fill={heatmap ? "#f6f6f2" : REGION[r.id].fill}
                  opacity={!heatmap && region !== "all" && region !== r.id ? 0.45 : 1}
                />
              ))}
              {/* Price heatmap: districts shaded by average psf */}
              {heatmap &&
                sgDistricts.map((d) => {
                  const v = shading.values.get(d.id);
                  return <path key={`h-${d.id}`} d={d.d} fill={v ? bandColour(v.avgPsf, bands)! : NO_DATA} />;
                })}
              {/* Geography: parks, water, major roads */}
              <path d={sgParks} fill="#cfe6c8" opacity={0.85} fillRule="evenodd" pointerEvents="none" />
              <path d={sgWater} fill="#c7dde8" fillRule="evenodd" pointerEvents="none" />
              <path d={sgMajorRoads} fill="#ffffff" fillOpacity={overview ? 0.6 : 0.9} stroke="#dcd6ca" strokeWidth={0.6} vectorEffect="non-scaling-stroke" fillRule="evenodd" pointerEvents="none" />
              {/* Districts: thin boundaries; they also catch hover and taps */}
              {sgDistricts.map((d) => (
                <path
                  key={`d-${d.id}`}
                  d={d.d}
                  data-district={d.id}
                  fill="transparent"
                  stroke="#9ba7b0"
                  strokeOpacity={0.7}
                  strokeWidth={0.7}
                  vectorEffect="non-scaling-stroke"
                  onClick={() => {
                    if (!wasDrag()) setPinnedDistrict((cur) => (cur === d.id ? null : d.id));
                  }}
                />
              ))}
              {/* Regions: slightly stronger boundaries */}
              {sgRegions.map((r) => (
                <path key={`rb-${r.id}`} d={r.d} fill="none" stroke="#6c7782" strokeWidth={1.3} vectorEffect="non-scaling-stroke" pointerEvents="none" />
              ))}
              {region !== "all" && (() => {
                const r = sgRegions.find((x) => x.id === region)!;
                return <path d={r.d} fill="none" stroke={REGION[region].accent} strokeWidth={2.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />;
              })()}
              {districtInfo && (
                <path d={districtInfo.d} fill={districtAccent(districtInfo.id)} fillOpacity={0.08} stroke={districtAccent(districtInfo.id)} strokeWidth={2.4} vectorEffect="non-scaling-stroke" pointerEvents="none" />
              )}
              {selected && located(selected) && (() => {
                const { x, y } = toXY(selected.lat, selected.lon);
                return (
                  <circle cx={x} cy={y} r={NEARBY_KM * 1000} fill={NAVY} fillOpacity={0.04} stroke={NAVY} strokeOpacity={0.4} strokeDasharray={`${6 * mPerPx} ${5 * mPerPx}`} strokeWidth={1.2 * mPerPx} pointerEvents="none" />
                );
              })()}
              {/* MRT stations, when zoomed in */}
              {view.w < 12000 &&
                sgStations.map(([name, lat, lon]) => {
                  const { x, y } = toXY(lat, lon);
                  return (
                    <g key={name} pointerEvents="none" transform={`translate(${x} ${y}) scale(${mPerPx})`}>
                      <rect x={-3} y={-3} width={6} height={6} rx={1.5} fill="#fff" stroke="#55606b" strokeWidth={1.2} />
                    </g>
                  );
                })}
              {/* Labels */}
              {candidates
                .filter((c) => visibleLabels.has(c.key))
                .map((c) => (
                  <g key={c.key} transform={`translate(${c.style === "station" ? c.x : c.x} ${c.y}) scale(${mPerPx})`} pointerEvents="none">
                    <text
                      x={c.style === "station" ? 7 : 0}
                      y={c.fontPx * 0.36}
                      textAnchor={c.style === "station" ? "start" : "middle"}
                      fontSize={c.fontPx}
                      fontWeight={c.style === "region" ? 800 : c.style === "district" ? 600 : 500}
                      fontStyle={c.style === "area" ? "italic" : undefined}
                      letterSpacing={c.style === "region" ? 1.5 : undefined}
                      fill={c.style === "region" ? c.colour : c.style === "district" ? "#26323b" : "#5d6870"}
                      stroke="#ffffff"
                      strokeWidth={c.style === "region" ? 3.5 : 3}
                      strokeOpacity={0.9}
                      paintOrder="stroke"
                      fontFamily="var(--font-archivo), sans-serif"
                    >
                      {c.text}
                    </text>
                  </g>
                ))}
              {/* Markers and count bubbles */}
              {groups.map((g) => {
                if (g.items.length > 1) {
                  const r = (g.items.length > 99 ? 17 : 14.5) * mPerPx;
                  return (
                    <g
                      key={`c-${g.items[0].key}`}
                      role="button"
                      aria-label={`${g.items.length} listings close together. Show them`}
                      className="cursor-pointer"
                      onClick={() => {
                        if (wasDrag()) return;
                        const xs = g.items.map((i) => i.x);
                        const ys = g.items.map((i) => i.y);
                        const spread = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * (size.w / size.h));
                        setView({ cx: g.x, cy: g.y, w: clampW(Math.max(spread * 2.4, view.w / 3)) });
                      }}
                    >
                      <circle cx={g.x} cy={g.y + 1.2 * mPerPx} r={r} fill="#000" opacity={0.1} />
                      <circle cx={g.x} cy={g.y} r={r} fill="#ffffff" stroke={NAVY} strokeWidth={1.5 * mPerPx} />
                      <text x={g.x} y={g.y + 4.5 * mPerPx} textAnchor="middle" fontSize={13 * mPerPx} fontWeight={700} fill={NAVY} fontFamily="var(--font-archivo), sans-serif">
                        {g.items.length}
                      </text>
                    </g>
                  );
                }
                const it = g.items[0];
                const on = it.key === selectedKey;
                const name = it.project.name;
                return (
                  <g
                    key={it.key}
                    role="button"
                    aria-label={`${name}, ${KIND[it.kind].label}`}
                    className="cursor-pointer"
                    transform={`translate(${it.x} ${it.y}) scale(${mPerPx * (on ? 1.2 : 1)})`}
                    onClick={() => {
                      if (!wasDrag()) select(it.key);
                    }}
                  >
                    <Marker kind={it.kind} ring={on ? (it.region ? REGION[it.region].accent : NAVY) : undefined} />
                    {(on || view.w < 6000) && (
                      <g transform="translate(13 -25)">
                        <rect x={0} y={0} width={name.length * 6.1 + KIND[it.kind].badge.length * 5.6 + 20} height={18} rx={9} fill="#ffffff" stroke={NAVY} strokeOpacity={0.25} />
                        <text x={8} y={12.5} fontSize={11} fontWeight={700} fill={NAVY} fontFamily="var(--font-archivo), sans-serif">
                          {name}
                          <tspan dx={5} fontSize={9.5} fontWeight={600} fill="#5d6870">
                            {KIND[it.kind].badge}
                          </tspan>
                        </text>
                      </g>
                    )}
                    <title>{`${name} (${KIND[it.kind].label})`}</title>
                  </g>
                );
              })}
            </svg>

            {/* Region filter and view switch */}
            <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-col items-start gap-2 pr-14">
              <div role="group" aria-label="Region" className="pointer-events-auto flex max-w-full overflow-x-auto rounded-xl bg-white/95 p-1 shadow-md [scrollbar-width:none]">
                {(["all", ...REGIONS] as const).map((r) => {
                  const on = region === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={on}
                      onClick={() => chooseRegion(r)}
                      title={r === "all" ? "All regions" : REGION[r].name}
                      aria-label={r === "all" ? "All regions" : `${r}, ${REGION[r].name}`}
                      className={`flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 font-display-normal text-sm font-semibold sm:gap-2 sm:px-3 ${on ? "bg-[#14284b] text-white" : "text-canopy/80 hover:bg-mist"}`}
                    >
                      {r !== "all" && <span aria-hidden="true" className="size-2.5 rounded-full ring-2 ring-white/70" style={{ background: REGION[r].accent }} />}
                      {r === "all" ? (
                        <>
                          <span className="sm:hidden">All</span>
                          <span className="max-sm:hidden">All regions</span>
                        </>
                      ) : (
                        r
                      )}
                    </button>
                  );
                })}
              </div>
              {shading.basis !== null && (
                <div role="group" aria-label="Map view" className="pointer-events-auto flex rounded-xl bg-white/95 p-1 shadow-md">
                  {(["regions", "heatmap"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={mode === m}
                      onClick={() => setMode(m)}
                      className={`min-h-11 rounded-lg px-3 font-display-normal text-sm font-semibold ${mode === m ? "bg-[#14284b] text-white" : "text-canopy/80 hover:bg-mist"}`}
                    >
                      {m === "regions" ? "Regions" : "Price heatmap"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Zoom and reset */}
            <div className="absolute right-3 top-3 flex flex-col divide-y divide-canopy/10 overflow-hidden rounded-xl bg-white shadow-md">
              <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1 / 1.6)} className={`${panelBtn} text-xl font-semibold`}>
                +
              </button>
              <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1.6)} className={`${panelBtn} text-xl font-semibold`}>
                −
              </button>
              <button type="button" aria-label="Reset view" title="Reset view" onClick={() => chooseRegion("all")} className={panelBtn}>
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 12a9 9 0 1 0 3-6.7" />
                  <path d="M3 4v5h5" />
                </svg>
              </button>
            </div>

            {/* District card (hover or tap) */}
            {districtInfo && !cardOpen && (
              <div className="pointer-events-none absolute bottom-3 left-1/2 w-[min(22rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-xl bg-white/95 px-4 py-3 font-display-normal text-sm shadow-md sm:bottom-12 sm:left-auto sm:right-3 sm:translate-x-0">
                <p className="font-semibold text-[#14284b]">
                  {districtInfo.id} · {districtInfo.name}
                </p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-canopy/80">
                  {(Object.entries(districtRegions[districtInfo.id] ?? {}) as [Region, number][]).map(([r, share]) => (
                    <span key={r} className="flex items-center gap-1.5">
                      <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: REGION[r].accent }} />
                      {r}
                      {share < 0.98 ? ` ${Math.round(share * 100)}%` : ""}
                    </span>
                  ))}
                  <span>
                    {districtListings} listing{districtListings === 1 ? "" : "s"}
                  </span>
                  {heatmap && shading.values.get(districtInfo.id) && <span>Avg. {money(shading.values.get(districtInfo.id)!.avgPsf)} psf</span>}
                </p>
              </div>
            )}

            {/* Legend */}
            {!cardOpen && (
              <div className="absolute bottom-3 left-3 max-sm:bottom-auto max-sm:left-auto max-sm:right-3 max-sm:top-[10.5rem]">
                <button
                  type="button"
                  aria-expanded={legendOpen}
                  onClick={() => setLegendOpen((v) => !v)}
                  className="min-h-11 rounded-xl bg-white/95 px-3 font-display-normal text-sm font-semibold text-[#14284b] shadow-md sm:hidden"
                >
                  {legendOpen ? "Hide key" : "Key"}
                </button>
                <div className={`${legendOpen ? "block" : "hidden"} mt-2 w-60 rounded-xl bg-white/95 p-3 font-display-normal text-[12.5px] shadow-md max-sm:absolute max-sm:right-0 sm:mt-0 sm:block`}>
                  {heatmap ? (
                    <>
                      <p className="font-semibold text-[#14284b]">Average price per sq ft</p>
                      <ul className="mt-1.5 grid gap-1">
                        {bands.map((b) => (
                          <li key={b.colour} className="flex items-center gap-2 tabular-nums">
                            <span aria-hidden="true" className="size-3 rounded-sm border border-black/10" style={{ background: b.colour }} />
                            S$ {b.from.toLocaleString("en-SG")} – {b.to.toLocaleString("en-SG")}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1.5 text-[11px] leading-snug text-stone">By postal district. {basisNote}.</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-[#14284b]">Market regions</p>
                      <ul className="mt-1.5 grid gap-1.5">
                        {REGIONS.map((r) => (
                          <li key={r} className="flex items-center gap-2">
                            <span aria-hidden="true" className="h-3.5 w-5 rounded-[4px] border-2" style={{ background: REGION[r].fill, borderColor: REGION[r].accent }} />
                            <span>
                              <strong className="font-semibold">{r}</strong> {REGION[r].name}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-canopy/10 pt-2">
                    {(Object.keys(KIND) as Kind[]).map((k) => (
                      <li key={k} className="flex items-center gap-1">
                        <svg viewBox="-12 -29 24 31" className="h-4 w-3.5" aria-hidden="true">
                          <Marker kind={k} />
                        </svg>
                        {KIND[k].label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Project card */}
            {selectedItem && (
              <div className="absolute inset-x-2 bottom-2 z-10 max-h-[62%] overflow-y-auto rounded-2xl bg-white shadow-xl sm:inset-x-auto sm:bottom-3 sm:left-3 sm:w-[23rem]">
                <ProjectCard
                  p={selectedItem.project}
                  kind={selectedItem.kind}
                  region={selectedItem.region}
                  link={projectLink?.(selectedItem.project) ?? null}
                  onClose={() => setSelectedKey(null)}
                  onDetails={() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                />
              </div>
            )}

            <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-white/85 px-2 py-1 font-display-normal text-[11px] text-canopy/80 max-sm:hidden">
              {(() => {
                const kmBar = view.w > 20000 ? 5 : view.w > 8000 ? 2 : view.w > 4000 ? 1 : 0.5;
                return (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-1 rounded bg-[#14284b]" style={{ width: `${(kmBar * 1000) / mPerPx}px` }} />
                    {kmBar < 1 ? `${kmBar * 1000} m` : `${kmBar} km`}
                  </span>
                );
              })()}
            </div>
          </div>
          <p className="border-t border-canopy/10 bg-mist px-4 py-2 text-xs text-stone">
            Map: URA Master Plan 2019 subzones and land use, LTA station exits (data.gov.sg); addresses from OneMap. Regions follow URA: CCR is postal districts
            9 to 11, the Downtown Core and Sentosa; RCR the rest of the Central Region; OCR the rest. {DISTRICTS_NOTE}
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
              onSelect={(p) => select(p.id, located(p) ? toXY(p.lat, p.lon) : undefined)}
            />
          ) : (
            <div className={`${card} p-5`}>
              <p className="font-display-normal font-semibold">Choose a listing on the map or in the list.</p>
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
                <th scope="col" className="px-3 py-2.5 font-semibold">Region</th>
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
                const r = projectRegion(p);
                return (
                  <tr key={p.id} className={`border-t border-canopy/10 ${p.id === selectedKey ? "bg-[#eef1f7]" : ""}`}>
                    <th scope="row" className="px-3 py-2 text-left">
                      <button type="button" onClick={() => select(p.id, located(p) ? toXY(p.lat, p.lon) : undefined)} className="font-semibold text-reservoir underline underline-offset-2">
                        {p.name}
                      </button>
                    </th>
                    <td className="px-3 py-2">
                      {r ? (
                        <span className="flex items-center gap-1.5">
                          <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: REGION[r].accent }} />
                          {r}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-canopy/80">{projectDistrict(p) ?? "—"}</td>
                    <td className="px-3 py-2">{bedroomRange(p).join(", ") || "—"}</td>
                    <td className="px-3 py-2 text-right">{f !== null ? short(f) : "—"}</td>
                    <td className="px-3 py-2 text-right">{p.unitsLeft?.toLocaleString("en-SG") ?? "—"}</td>
                    <td className="px-3 py-2">{KIND[k].label}</td>
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

function CardHeader({ title, badges, onClose }: { title: string; badges: { text: string; colour?: string }[]; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-display-normal text-[15px] font-bold leading-snug text-[#14284b]">{title}</p>
        <p className="mt-1 flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <span key={b.text} className="flex items-center gap-1 rounded-full bg-mist px-2 py-0.5 font-display-normal text-[11px] font-semibold text-canopy/85">
              {b.colour && <span aria-hidden="true" className="size-2 rounded-full" style={{ background: b.colour }} />}
              {b.text}
            </span>
          ))}
        </p>
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 grid size-11 shrink-0 place-items-center rounded-full text-xl text-canopy/70 hover:bg-mist">
        ×
      </button>
    </div>
  );
}

function ProjectCard({
  p,
  kind,
  region,
  link,
  onClose,
  onDetails,
}: {
  p: CatalogueProject;
  kind: MapKind;
  region: Region | null;
  link: string | null;
  onClose: () => void;
  onDetails: () => void;
}) {
  const img = imageFor(p);
  const [imgOk, setImgOk] = useState(true);
  const rows = priceByBedroom(p);
  const from = fromPrice(p);
  return (
    <div>
      {img && imgOk && (
        <div className="relative h-32 w-full overflow-hidden bg-mist">
          <AssetImg src={img} alt={`${p.name}. Artist's impression.`} loading="lazy" onError={() => setImgOk(false)} className="h-full w-full object-cover" />
          <span className="absolute bottom-1.5 right-2 rounded bg-black/45 px-1.5 py-0.5 font-display-normal text-[10px] text-white">Artist&apos;s impression</span>
        </div>
      )}
      <div className="p-4">
        <CardHeader
          title={p.name}
          badges={[{ text: KIND[kind].label }, ...(region ? [{ text: region, colour: REGION[region].accent }] : []), ...(projectDistrict(p) ? [{ text: projectDistrict(p)! }] : [])]}
          onClose={onClose}
        />
        <p className="mt-2 font-display-normal text-[17px] font-bold tabular-nums text-[#14284b]">
          {from !== null ? `From ${short(from)}` : kind === "upcoming" ? "Prices released at launch" : "Prices not released yet"}
        </p>
        <p className="font-display-normal text-[13px] text-canopy/75">
          {[
            p.unitsLeft !== null && p.totalUnits ? `${p.unitsLeft.toLocaleString("en-SG")} of ${p.totalUnits.toLocaleString("en-SG")} units left` : null,
            p.launchDate ? `Launch ${p.launchDate}` : p.launchNote,
            p.tenure,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {rows.length > 0 && (
          <table className="mt-3 w-full border-collapse font-display-normal text-[13px] tabular-nums">
            <caption className="sr-only">Prices by bedrooms, available units</caption>
            <thead>
              <tr className="text-left text-[11px] text-canopy/60">
                <th scope="col" className="py-1 font-semibold">Bedrooms</th>
                <th scope="col" className="py-1 text-right font-semibold">From</th>
                <th scope="col" className="py-1 text-right font-semibold">Psf</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.bedrooms} className="border-t border-canopy/10">
                  <th scope="row" className="py-1 text-left font-medium">{r.bedrooms} BR</th>
                  <td className="py-1 text-right">{r.loPrice !== null ? short(r.loPrice) : "—"}</td>
                  <td className="py-1 text-right">{r.loPsf !== null ? `${money(r.loPsf)}${r.hiPsf !== null && r.hiPsf !== r.loPsf ? `–${money(r.hiPsf).slice(1)}` : ""}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onDetails} className="min-h-11 rounded-full bg-[#14284b] px-4 font-display-normal text-sm font-semibold text-white">
            Full details
          </button>
          {link && (
            <a href={link} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-full border border-[#14284b]/30 px-4 font-display-normal text-sm font-semibold text-[#14284b]">
              Open the guide
            </a>
          )}
        </div>
      </div>
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
  const region = projectRegion(p);
  const s = { label: onMap(p, today) ? KIND[mapKind(p, today)].label : "Sold out", colour: region ? REGION[region].accent : NAVY };
  const withCagr = nearbyMarket.map((n) => ({ ...n, cagr: projectCagr(n.item), latest: latestPsf(n.item) }));
  const facts = [
    ["Address", p.address],
    ["District", [projectDistrict(p), p.area].filter(Boolean).join(" · ") || null],
    ["Region", region ? `${region} · ${REGION[region].name}` : null],
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
            Open the {p.name.replace(/^the /i, "")} guide
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
