"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Unit, UnitStatus } from "../model/types";
import { levelView } from "../lib/clearance";
import { unitLabel } from "../lib/dataset-index";
import type { Engine } from "../lib/engine";
import { compactMoney } from "../lib/format";
import { compassWords16 } from "../lib/geometry";
import { onOffer } from "../lib/pricing";
import type { RankedUnit } from "../lib/recommend";
import { formatClock, sunPosition } from "../lib/solar";
import type { Overlay } from "./site-plan";
import { SitePlan } from "./site-plan";
import { BEDROOM_COLOURS, VIEW_COLOURS } from "./ui";

const Site3D = dynamic(() => import("./site-3d"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center font-display-normal text-sm text-stone">
      Loading the 3D view…
    </div>
  ),
});

type ColourMode = "bedrooms" | "collection" | "sun" | "budget" | "view" | "availability";

const COLOUR_MODES: { id: ColourMode; label: string }[] = [
  { id: "bedrooms", label: "Bedroom type" },
  { id: "collection", label: "Collection" },
  { id: "budget", label: "Within budget" },
  { id: "view", label: "View clearance" },
  { id: "sun", label: "Afternoon sun" },
  { id: "availability", label: "Availability" },
];

const COLLECTION_COLOURS = ["#9cc2cb", "#d3b27a", "#b98fb2", "#8fae8a"];

/** Pale to deep amber for none to 4 hours of average afternoon sun. */
function sunColour(minutes: number): string {
  const t = Math.min(1, minutes / 240);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${mix(236, 214)}, ${mix(238, 120)}, ${mix(228, 18)})`;
}

const STATUS_COLOURS: Record<UnitStatus, string> = {
  available: "#2f7d57",
  reserved: "#dcc08a",
  sold: "#b4bab3",
  "not-released": "#e3e6e1",
  pending: "#d9ded6",
};
const FADED = "#eceee9";

const QUICK_MONTHS = [
  { month: 2, label: "Mar" },
  { month: 5, label: "Jun" },
  { month: 8, label: "Sep" },
  { month: 11, label: "Dec" },
];

function webglSupported(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

const noSubscribe = () => () => {};

export function SiteView({
  engine,
  ranked,
  selectedStackId,
  selectedUnit,
  level,
  onSelectStack,
  onSelectUnit,
  month,
  minutes,
  onMonth,
  onMinutes,
  shadowsSignal = 0,
  focus,
}: {
  engine: Engine;
  ranked: RankedUnit[];
  selectedStackId: string;
  selectedUnit: Unit | null;
  level: number;
  onSelectStack: (id: string) => void;
  onSelectUnit: (u: Unit) => void;
  month: number;
  minutes: number;
  onMonth: (m: number) => void;
  onMinutes: (m: number) => void;
  /** Bumped by "See shadows at 4pm": switches to 3D with sun and shadows on. */
  shadowsSignal?: number;
  /** Homes that match the buyer's filters; the rest are faded. */
  focus?: (u: Unit) => boolean;
}) {
  const ix = engine.ix;
  const ds = ix.ds;
  const canUse3D = useSyncExternalStore(noSubscribe, webglSupported, () => true);
  const [mode, setMode] = useState<"3d" | "flat">("3d");
  const modes = useMemo(() => {
    const has: Record<ColourMode, boolean> = {
      bedrooms: ds.layouts.some((l) => l.bedrooms !== null),
      collection: ds.blocks.some((b) => b.collection),
      budget: ds.units.some((u) => u.price !== null),
      view: ds.viewTargets.length > 0,
      sun: true,
      availability: new Set(ds.units.map((u) => u.status)).size > 1,
    };
    return COLOUR_MODES.filter((m) => has[m.id]);
  }, [ds]);
  const collections = useMemo(
    () => [...new Set(ds.blocks.map((b) => b.collection).filter((c): c is string => !!c))],
    [ds],
  );
  const [colourMode, setColourMode] = useState<ColourMode>(modes[0]?.id ?? "sun");
  const [showSurroundings, setShowSurroundings] = useState(true);
  const [showSun, setShowSun] = useState(false);
  const [overlays, setOverlays] = useState<Set<Overlay>>(new Set(["views"]));
  const [azimuth, setAzimuth] = useState(0);
  const [resetSignal, setResetSignal] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [seenSignal, setSeenSignal] = useState(shadowsSignal);
  if (shadowsSignal !== seenSignal) {
    // Adjust state during render rather than in an effect (React's recommended pattern).
    setSeenSignal(shadowsSignal);
    setMode("3d");
    setShowSun(true);
    setPlaying(false);
  }
  const facilities = useMemo(
    () =>
      [
        ...ds.exposureSources
          .filter((s) => !["expressway", "main-road", "walkway"].includes(s.kind))
          .map((s) => ({ name: s.name, position: s.geometry[s.geometry.length - 1] })),
      ].map((f, i) => ({ ...f, number: i + 1 })),
    [ds],
  );
  const minutesRef = useRef(minutes);
  useEffect(() => {
    minutesRef.current = minutes;
  }, [minutes]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const next = minutesRef.current + 10;
      if (next > 19 * 60) {
        setPlaying(false);
        return;
      }
      onMinutes(next);
    }, 90);
    return () => window.clearInterval(id);
  }, [playing, onMinutes]);

  const sun = sunPosition(month, minutes, ds.project.latitudeDeg, ds.project.longitudeDeg, ds.project.utcOffsetHours);
  const eligible = useMemo(() => new Set(ranked.filter((r) => r.eligible).map((r) => r.assessment.unit.id)), [ranked]);

  const colours = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of ds.units) {
      const onSale = onOffer(u);
      let c: string;
      switch (colourMode) {
        case "bedrooms": {
          const beds = ix.stackLayout(u.stackId).bedrooms;
          c = beds === null ? "#d9ded6" : BEDROOM_COLOURS[beds] ?? "#cccccc";
          break;
        }
        case "collection": {
          const col = ix.stackBlock(u.stackId).collection;
          c = col ? COLLECTION_COLOURS[collections.indexOf(col) % COLLECTION_COLOURS.length] : "#d9ded6";
          break;
        }
        case "sun":
          c = sunColour(engine.sunProvider.estimate(u).living.annualAverageMin);
          break;
        case "budget":
          c = eligible.has(u.id) ? "#2f7d57" : onSale ? "#c6ccc5" : FADED;
          break;
        case "view": {
          const cat = levelView(engine.view(u.stackId), u.level)?.category ?? "unknown";
          c = VIEW_COLOURS[cat];
          break;
        }
        case "availability":
          c = STATUS_COLOURS[u.status];
          break;
      }
      if (focus && !focus(u) && u.id !== selectedUnit?.id) c = FADED;
      map.set(u.id, c);
    }
    return map;
  }, [ds.units, colourMode, eligible, engine, ix, collections, focus, selectedUnit]);

  const tooltip = selectedUnit
    ? {
        title: unitLabel(ix, selectedUnit),
        detail: `${
          ix.stackLayout(selectedUnit.stackId).bedrooms === null && ix.stackBlock(selectedUnit.stackId).collection
            ? `${ix.stackBlock(selectedUnit.stackId).collection} Collection`
            : selectedUnit.typeCode
              ? `Type ${selectedUnit.typeCode}`
              : ix.stackLayout(selectedUnit.stackId).name
        }, ${
          selectedUnit.price !== null
            ? `${compactMoney(selectedUnit.price)}${selectedUnit.priceIsEstimate ? " (estimate)" : ""}`
            : selectedUnit.status === "not-released"
              ? "not yet released"
              : selectedUnit.status === "pending"
                ? "awaiting price list"
                : selectedUnit.status
        }`,
      }
    : null;

  const legend: { colour: string; label: string }[] =
    colourMode === "collection"
      ? collections.map((c, i) => ({ colour: COLLECTION_COLOURS[i % COLLECTION_COLOURS.length], label: `${c} Collection` }))
      : colourMode === "sun"
        ? [
            { colour: sunColour(0), label: "No afternoon sun" },
            { colour: sunColour(60), label: "About 1 hour" },
            { colour: sunColour(150), label: "About 2.5 hours" },
            { colour: sunColour(240), label: "4 hours or more (living room, yearly average, estimated)" },
          ]
        : colourMode === "bedrooms"
      ? [
          ...[2, 3, 4, 5]
            .filter((b) => ds.layouts.some((l) => l.bedrooms === b))
            .map((b) => ({ colour: BEDROOM_COLOURS[b], label: `${b} bedrooms` })),
        ]
      : colourMode === "budget"
        ? [
            { colour: "#2f7d57", label: "Meets your essentials" },
            { colour: "#c6ccc5", label: "On sale, outside your essentials" },
            { colour: FADED, label: "Not on sale" },
          ]
        : colourMode === "view"
          ? [
              { colour: VIEW_COLOURS.below, label: "Below obstruction" },
              { colour: VIEW_COLOURS.partial, label: "Partially cleared" },
              { colour: VIEW_COLOURS.clear, label: "Estimated clear view" },
              { colour: VIEW_COLOURS["clear-limited"], label: "Clear, limited further gain" },
            ]
          : [
              { colour: STATUS_COLOURS.available, label: "Available" },
              { colour: STATUS_COLOURS.reserved, label: "Reserved" },
              { colour: STATUS_COLOURS.sold, label: "Sold" },
              { colour: STATUS_COLOURS["not-released"], label: "Not yet released" },
              { colour: STATUS_COLOURS.pending, label: "Awaiting price list" },
            ];

  const toggleOverlay = (o: Overlay) =>
    setOverlays((s) => {
      const next = new Set(s);
      if (next.has(o)) next.delete(o);
      else next.add(o);
      return next;
    });

  const segButton = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 font-display-normal text-sm font-medium ${
      active ? "bg-paper text-canopy shadow-sm" : "text-canopy/70 hover:text-canopy"
    }`;
  const toggleButton = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 font-display-normal text-sm font-medium ${
      active ? "border-canopy bg-canopy text-mist" : "border-canopy/25 text-canopy/80"
    }`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Map type" className="flex rounded-full bg-mist-deep p-1">
          <button type="button" aria-pressed={mode === "3d"} onClick={() => setMode("3d")} className={segButton(mode === "3d")} disabled={!canUse3D}>
            3D view
          </button>
          <button type="button" aria-pressed={mode === "flat"} onClick={() => setMode("flat")} className={segButton(mode === "flat")}>
            Flat plan
          </button>
        </div>
        {mode === "3d" && canUse3D && (
          <button
            type="button"
            aria-expanded={showKey}
            aria-controls="facilities-key"
            onClick={() => setShowKey((v) => !v)}
            className="font-display-normal text-sm font-medium text-reservoir underline underline-offset-4"
          >
            Facilities key
          </button>
        )}
        {!canUse3D && (
          <p className="font-display-normal text-sm text-stone">3D needs WebGL, which this browser doesn&apos;t support.</p>
        )}
      </div>

      {mode === "3d" && canUse3D ? (
        <div className="overflow-hidden rounded-xl border border-canopy/10 bg-paper">
          <div
            className="relative h-[420px] touch-none sm:h-[520px]"
            aria-label="3D view of the site. Drag to spin, pinch or scroll to zoom, tap a unit to select it. Keyboard users can choose stacks with the stack list or the flat plan."
            role="region"
          >
            <Site3D
              ds={ds}
              facilities={showKey ? facilities : null}
              colours={colours}
              selectedStackId={selectedStackId}
              selectedUnit={selectedUnit}
              tooltip={tooltip}
              onPickUnit={onSelectUnit}
              onPickStack={onSelectStack}
              showSurroundings={showSurroundings}
              showSun={showSun}
              sun={sun}
              resetSignal={resetSignal}
              onAzimuth={setAzimuth}
              gates={ds.gates.map((g) => {
                // Sit each gate label just outside the site so it never covers a facility pin.
                const cx = ds.project.siteBounds.width / 2;
                const cy = ds.project.siteBounds.height / 2;
                const dx = g.position.x - cx;
                const dy = g.position.y - cy;
                const len = Math.hypot(dx, dy) || 1;
                return {
                  name: g.name,
                  position: { x: g.position.x + (dx / len) * 16, y: g.position.y + (dy / len) * 16 },
                };
              })}
              mrt={ds.project.display?.mrtLabel ? { name: ds.project.display.mrtLabel.text, position: ds.project.display.mrtLabel.at } : null}
            />
            <button
              type="button"
              onClick={() => setResetSignal((n) => n + 1)}
              aria-label="Compass. Select to reset the view with north up."
              className="absolute right-3 top-3 grid size-16 place-items-center rounded-full bg-paper/90 font-display-normal shadow-md"
            >
              <svg viewBox="-30 -30 60 60" className="size-14" style={{ transform: `rotate(${azimuth - ds.project.planNorthDeg}deg)` }} aria-hidden="true">
                <line x1="0" y1="-19" x2="0" y2="19" stroke="#6f7a71" strokeWidth="2.5" />
                <line x1="0" y1="-19" x2="0" y2="0" stroke="#b3532e" strokeWidth="3" />
                <text x="0" y="-21" textAnchor="middle" fontSize="10" fontWeight="700" fill="#b3532e">N</text>
                <text x="0" y="28" textAnchor="middle" fontSize="9" fill="#10291c">S</text>
                <text x="24" y="3" textAnchor="middle" fontSize="9" fill="#10291c">E</text>
                <text x="-24" y="3" textAnchor="middle" fontSize="9" fill="#10291c">W</text>
              </svg>
            </button>
          </div>

          {showKey && (
            <ol id="facilities-key" className="grid gap-x-6 gap-y-1.5 border-t border-canopy/10 p-4 font-display-normal text-sm sm:grid-cols-2">
              {facilities.map((f) => (
                <li key={f.number} className="flex items-center gap-2">
                  <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-reservoir text-[10px] font-bold text-paper">
                    {f.number}
                  </span>
                  {f.name}
                </li>
              ))}
            </ol>
          )}

          <div className="grid gap-4 border-t border-canopy/10 p-4">
            <div role="group" aria-label="Colour units by" className="flex flex-wrap gap-1 self-start rounded-full bg-mist-deep p-1">
              {modes.map((m) => (
                <button key={m.id} type="button" aria-pressed={colourMode === m.id} onClick={() => setColourMode(m.id)} className={segButton(colourMode === m.id)}>
                  {m.label}
                </button>
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 font-display-normal text-sm text-canopy/80">
              {legend.map((l) => (
                <li key={l.label} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-3 rounded-sm border border-canopy/10" style={{ background: l.colour }} />
                  {l.label}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" aria-pressed={showSurroundings} onClick={() => setShowSurroundings((v) => !v)} className={toggleButton(showSurroundings)}>
                Surroundings
              </button>
              <button type="button" aria-pressed={showSun} onClick={() => setShowSun((v) => !v)} className={toggleButton(showSun)}>
                Sun &amp; shadows
              </button>
              <button type="button" onClick={() => setResetSignal((n) => n + 1)} className="ml-1 font-display-normal text-sm font-medium text-reservoir underline underline-offset-4">
                Reset view
              </button>
            </div>

            {showSun && (
              <div className="grid gap-3 border-t border-canopy/10 pt-4">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (!playing && minutes >= 19 * 60) onMinutes(7 * 60);
                      setPlaying((p) => !p);
                    }}
                    aria-label={playing ? "Pause the day" : "Play the day"}
                    className="grid size-11 shrink-0 place-items-center rounded-full border border-canopy/25"
                  >
                    {playing ? (
                      <svg viewBox="0 0 12 12" className="size-3.5" aria-hidden="true"><rect x="2" y="1" width="3" height="10" fill="#10291c" /><rect x="7" y="1" width="3" height="10" fill="#10291c" /></svg>
                    ) : (
                      <svg viewBox="0 0 12 12" className="size-3.5" aria-hidden="true"><path d="M3 1 L11 6 L3 11 z" fill="#10291c" /></svg>
                    )}
                  </button>
                  <label htmlFor="sun-time-3d" className="sr-only">Time of day</label>
                  <input
                    id="sun-time-3d"
                    type="range"
                    min={7 * 60}
                    max={19 * 60}
                    step={10}
                    value={minutes}
                    aria-valuetext={formatClock(minutes)}
                    onChange={(e) => {
                      setPlaying(false);
                      onMinutes(Number(e.target.value));
                    }}
                    className="w-full accent-reservoir"
                  />
                </div>
                <div role="group" aria-label="Month" className="flex flex-wrap gap-1 self-start rounded-full bg-mist-deep p-1">
                  {QUICK_MONTHS.map((m) => (
                    <button key={m.month} type="button" aria-pressed={month === m.month} onClick={() => onMonth(m.month)} className={segButton(month === m.month)}>
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="font-display-normal text-base" aria-live="polite">
                  <span className="font-semibold">{formatClock(minutes)}</span>,{" "}
                  {sun.altitudeDeg > 0
                    ? `sun ${Math.round(sun.altitudeDeg)}° up, from the ${compassWords16(sun.azimuthDeg)}`
                    : "the sun is down"}
                </p>
              </div>
            )}
          </div>

          <p className="border-t border-canopy/10 bg-mist px-4 py-2.5 text-[0.8125rem] text-canopy/75">
            Drag to spin, pinch to zoom, tap a home for its price and floor plan. Towers are simple massing on the developer&apos;s site plan; shadows are indicative.
          </p>
        </div>
      ) : (
        <SitePlan
          engine={engine}
          selectedStackId={selectedStackId}
          onSelectStack={onSelectStack}
          overlays={overlays}
          onToggleOverlay={toggleOverlay}
          level={level}
          selectedUnit={selectedUnit}
          month={month}
          minutes={minutes}
        />
      )}
    </div>
  );
}
