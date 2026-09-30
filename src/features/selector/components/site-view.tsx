"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Unit, UnitStatus } from "../model/types";
import { levelView } from "../lib/clearance";
import { unitLabel } from "../lib/dataset-index";
import type { Engine } from "../lib/engine";
import { compactMoney } from "../lib/format";
import { compassWords16 } from "../lib/geometry";
import type { RankedUnit } from "../lib/recommend";
import { formatClock, sunPosition } from "../lib/solar";
import type { Overlay } from "./site-plan";
import { SitePlan } from "./site-plan";
import { VIEW_COLOURS } from "./ui";

const Site3D = dynamic(() => import("./site-3d"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center font-display-normal text-sm text-stone">
      Loading the 3D view…
    </div>
  ),
});

type ColourMode = "bedrooms" | "budget" | "view" | "availability";

const COLOUR_MODES: { id: ColourMode; label: string }[] = [
  { id: "bedrooms", label: "Bedroom type" },
  { id: "budget", label: "Within budget" },
  { id: "view", label: "View clearance" },
  { id: "availability", label: "Availability" },
];

const BEDROOM_COLOURS: Record<number, string> = { 2: "#8fbac6", 3: "#dcc08a", 4: "#b98fb2" };
const STATUS_COLOURS: Record<UnitStatus, string> = {
  available: "#2f7d57",
  reserved: "#dcc08a",
  sold: "#b4bab3",
  "not-released": "#e3e6e1",
};
const FADED = "#eceee9";

const QUICK_MONTHS = [
  { month: 2, label: "Mar" },
  { month: 5, label: "Jun" },
  { month: 8, label: "Sep" },
  { month: 11, label: "Dec" },
];

function mix(hex: string, towards: string, t: number): string {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(towards.slice(1), 16);
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

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
}) {
  const ix = engine.ix;
  const ds = ix.ds;
  const canUse3D = useSyncExternalStore(noSubscribe, webglSupported, () => true);
  const [mode, setMode] = useState<"3d" | "flat">("3d");
  const [colourMode, setColourMode] = useState<ColourMode>("bedrooms");
  const [showSurroundings, setShowSurroundings] = useState(true);
  const [showSun, setShowSun] = useState(true);
  const [overlays, setOverlays] = useState<Set<Overlay>>(new Set(["views"]));
  const [azimuth, setAzimuth] = useState(0);
  const [resetSignal, setResetSignal] = useState(0);
  const [playing, setPlaying] = useState(false);
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
      const onSale = u.status === "available";
      let c: string;
      switch (colourMode) {
        case "bedrooms":
          c = BEDROOM_COLOURS[ix.stackLayout(u.stackId).bedrooms] ?? "#cccccc";
          if (!onSale) c = mix(c, FADED, 0.65);
          break;
        case "budget":
          c = eligible.has(u.id) ? "#2f7d57" : onSale ? "#c6ccc5" : FADED;
          break;
        case "view": {
          const cat = levelView(engine.view(u.stackId), u.level)?.category ?? "unknown";
          c = VIEW_COLOURS[cat];
          if (!onSale) c = mix(c, FADED, 0.65);
          break;
        }
        case "availability":
          c = STATUS_COLOURS[u.status];
          break;
      }
      map.set(u.id, c);
    }
    return map;
  }, [ds.units, colourMode, eligible, engine, ix]);

  const tooltip = selectedUnit
    ? {
        title: unitLabel(ix, selectedUnit),
        detail: `${ix.stackLayout(selectedUnit.stackId).name}, ${
          selectedUnit.price !== null
            ? compactMoney(selectedUnit.price)
            : selectedUnit.status === "not-released"
              ? "not yet released"
              : selectedUnit.status
        }`,
      }
    : null;

  const legend: { colour: string; label: string }[] =
    colourMode === "bedrooms"
      ? [
          { colour: BEDROOM_COLOURS[2], label: "2 bedrooms" },
          { colour: BEDROOM_COLOURS[3], label: "3 bedrooms" },
          { colour: BEDROOM_COLOURS[4], label: "4 bedrooms" },
          { colour: FADED, label: "Not on sale" },
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
              gates={ds.gates.map((g) => ({ name: g.id === "main" ? "Main gate" : "South gate", position: g.position }))}
              mrt={{ name: "MRT Exit B", position: { x: 330, y: 214 } }}
            />
            <button
              type="button"
              onClick={() => setResetSignal((n) => n + 1)}
              aria-label="Compass. Select to reset the view with north up."
              className="absolute right-3 top-3 grid size-16 place-items-center rounded-full bg-paper/90 font-display-normal shadow-md"
            >
              <svg viewBox="-30 -30 60 60" className="size-14" style={{ transform: `rotate(${azimuth}deg)` }} aria-hidden="true">
                <line x1="0" y1="-19" x2="0" y2="19" stroke="#6f7a71" strokeWidth="2.5" />
                <line x1="0" y1="-19" x2="0" y2="0" stroke="#b3532e" strokeWidth="3" />
                <text x="0" y="-21" textAnchor="middle" fontSize="10" fontWeight="700" fill="#b3532e">N</text>
                <text x="0" y="28" textAnchor="middle" fontSize="9" fill="#10291c">S</text>
                <text x="24" y="3" textAnchor="middle" fontSize="9" fill="#10291c">E</text>
                <text x="-24" y="3" textAnchor="middle" fontSize="9" fill="#10291c">W</text>
              </svg>
            </button>
          </div>

          <div className="grid gap-4 border-t border-canopy/10 p-4">
            <div role="group" aria-label="Colour units by" className="flex flex-wrap gap-1 self-start rounded-full bg-mist-deep p-1">
              {COLOUR_MODES.map((m) => (
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

          <div className="border-t border-canopy/10 bg-mist px-4 py-3 text-sm text-canopy/80">
            <p>Drag to spin it around, pinch or scroll to zoom, and tap a unit for its price. The floor slider below follows your selection.</p>
            <p className="mt-1">
              Illustrative massing from the demo data. Sun positions are real for Singapore on the 21st of each month; buildings and trees are simplified, so treat shadows as indicative.
            </p>
          </div>
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
