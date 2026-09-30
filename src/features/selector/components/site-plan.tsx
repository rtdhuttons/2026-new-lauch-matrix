"use client";

import type { KeyboardEvent } from "react";
import type { Point, Unit } from "../model/types";
import type { Engine } from "../lib/engine";
import { bearingVector, compassPoint } from "../lib/geometry";
import type { Potential } from "../lib/exposure";
import { formatClock, MONTHS, sunPosition } from "../lib/solar";

export type Overlay = "sun" | "views" | "noise" | "privacy" | "routes" | "future";

export const OVERLAYS: { id: Overlay; label: string }[] = [
  { id: "sun", label: "Facing & sun" },
  { id: "views", label: "Views & obstructions" },
  { id: "noise", label: "Noise sources" },
  { id: "privacy", label: "Privacy" },
  { id: "routes", label: "Walking routes" },
  { id: "future", label: "Future development" },
];

const DEMO_VIEWBOX = { x: -125, y: -245, w: 545, h: 520 };

const POTENTIAL_COLOUR: Record<Potential, string> = {
  higher: "#7b3f9b",
  moderate: "#a57fbf",
  lower: "#cdb9dc",
};

const pts = (p: Point[]) => p.map((q) => `${q.x},${q.y}`).join(" ");

function alongPlan(p: Point, bearing: number, d: number, planNorthDeg: number): Point {
  const v = bearingVector(bearing, planNorthDeg);
  return { x: p.x + v.x * d, y: p.y + v.y * d };
}

function sunColour(minutes: number): string {
  // 0 min → pale, 4 h+ → deep amber
  const t = Math.min(1, minutes / 240);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${mix(250, 214)}, ${mix(240, 132)}, ${mix(214, 18)})`;
}

export function SitePlan({
  engine,
  selectedStackId,
  onSelectStack,
  overlays,
  onToggleOverlay,
  level,
  selectedUnit,
  month,
  minutes,
}: {
  engine: Engine;
  selectedStackId: string;
  onSelectStack: (id: string) => void;
  overlays: Set<Overlay>;
  onToggleOverlay: (o: Overlay) => void;
  level: number;
  selectedUnit: Unit | null;
  month: number;
  minutes: number;
}) {
  const { ds } = engine.ix;
  const planImage = ds.project.display?.planImage;
  const { width: siteW, height: siteH } = ds.project.siteBounds;
  const VIEWBOX = planImage
    ? { x: -12, y: -12, w: siteW + 24, h: siteH + 24 }
    : DEMO_VIEWBOX;
  const along = (p: Point, bearing: number, d: number) => alongPlan(p, bearing, d, ds.project.planNorthDeg);
  const dense = ds.stacks.length > 30;
  const markerR = dense ? 4.2 : 6;
  const siteCentre = { x: siteW / 2, y: siteH / 2 };
  const sunReach = Math.max(siteW, siteH) * 0.3;
  const on = (o: Overlay) => overlays.has(o);
  const selectedStack = engine.ix.stack(selectedStackId);
  const view = engine.view(selectedStackId);
  const assessment = selectedUnit ? engine.assess(selectedUnit) : null;
  const sun = sunPosition(month, minutes, ds.project.latitudeDeg, ds.project.longitudeDeg, ds.project.utcOffsetHours);

  // For sun colouring, each stack uses its unit at the chosen level, or the
  // closest level below it where the stack has a unit.
  const unitNear = (stackId: string): Unit | null => {
    const list = engine.ix.unitsInStack(stackId);
    let best: Unit | null = null;
    for (const u of list) if (u.level <= level) best = u;
    return best ?? list[0] ?? null;
  };

  const activateOnKey = (id: string) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelectStack(id);
    }
  };

  const viewObstacleIds = new Set(
    view.rays.flatMap((r) => r.obstacles.map((o) => o.obstruction.id)),
  );
  const bestGate = assessment?.mrt.best?.gate.id;

  return (
    <div>
      <div role="group" aria-label="Map overlays" className="mb-3 flex flex-wrap gap-2">
        {OVERLAYS.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={on(o.id)}
            onClick={() => onToggleOverlay(o.id)}
            className={`rounded-full border px-3 py-1.5 font-display-normal text-sm font-medium ${
              on(o.id)
                ? "border-canopy bg-canopy text-mist"
                : "border-canopy/20 bg-paper text-canopy/80 hover:border-canopy/50"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-canopy/10 bg-[#f6f8f4]">
        <svg
          viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}`}
          className="block h-auto w-full"
          role="group"
          aria-label={`Illustrative site plan of ${ds.project.name}. Select a stack to explore it.`}
        >
          <defs>
            <pattern id="hatch-landed" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="#cfd5cc" strokeWidth="2" />
            </pattern>
            <pattern id="hatch-future" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#b3413b" strokeWidth="1.5" strokeOpacity="0.55" />
            </pattern>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
            </marker>
          </defs>

          {/* View targets */}
          {ds.viewTargets.map((t) => (
            <polygon
              key={t.id}
              points={pts(t.footprint)}
              fill={t.id === "reservoir" ? "#cfe2e7" : "#d9e4d2"}
            />
          ))}
          {ds.project.isDemo && (
            <>
              <text x={120} y={-236} textAnchor="middle" className="fill-reservoir font-display-normal" fontSize="11" fontStyle="italic">
                Wrenfield Reservoir
              </text>
              <text x={-120} y={-120} className="fill-canopy/60 font-display-normal" fontSize="10" fontStyle="italic">
                Western woodland park
              </text>
            </>
          )}

          {/* Obstructions and surroundings */}
          {ds.obstructions
            .filter((o) => o.kind !== "own-block")
            .map((o) => {
              const highlighted = on("views") && viewObstacleIds.has(o.id);
              const fill =
                o.kind === "tree-belt"
                  ? "#bcd1b3"
                  : o.kind === "landed-housing"
                    ? "url(#hatch-landed)"
                    : "#d4d9d3";
              return (
                <g key={o.id}>
                  <polygon
                    points={pts(o.footprint)}
                    fill={fill}
                    stroke={highlighted ? "#10291c" : "#b3bbb2"}
                    strokeWidth={highlighted ? 1.6 : 0.6}
                  />
                </g>
              );
            })}
          {ds.project.isDemo && (
            <text x={110} y={236} textAnchor="middle" className="fill-canopy/55 font-display-normal" fontSize="10" fontStyle="italic">
              Landed estate
            </text>
          )}

          {/* Roads (the site plan image already draws its own) */}
          {!planImage && ds.exposureSources
            .filter((s) => s.kind === "expressway" || s.kind === "main-road")
            .map((s) => (
              <g key={s.id}>
                <polyline
                  points={pts(s.geometry)}
                  fill="none"
                  stroke="#c2c7c0"
                  strokeWidth={s.kind === "expressway" ? 12 : 7}
                  strokeLinecap="round"
                />
                <text
                  x={(s.geometry[0].x + s.geometry[1].x) / 2 + (s.kind === "main-road" && s.geometry[0].x === s.geometry[1].x ? 8 : 0)}
                  y={(s.geometry[0].y + s.geometry[1].y) / 2 + (s.geometry[0].y === s.geometry[1].y ? -8 : 0)}
                  fontSize="9"
                  className="fill-canopy/70 font-display-normal"
                  transform={
                    s.geometry[0].x === s.geometry[1].x || s.kind === "expressway"
                      ? `rotate(90 ${(s.geometry[0].x + s.geometry[1].x) / 2 + 8} ${(s.geometry[0].y + s.geometry[1].y) / 2})`
                      : undefined
                  }
                >
                  {s.name}
                </text>
              </g>
            ))}

          {/* Site boundary and facilities */}
          {planImage ? (
            <image href={planImage.src} x={0} y={0} width={planImage.widthM} height={planImage.heightM} preserveAspectRatio="none" opacity={overlays.size > 0 ? 0.85 : 1} />
          ) : (
            <>
              <rect
                x={0}
                y={0}
                width={ds.project.siteBounds.width}
                height={ds.project.siteBounds.height}
                fill="#eef2ec"
                stroke="#10291c"
                strokeDasharray="4 3"
                strokeWidth="0.8"
              />
              <polyline points="92,88 132,98" stroke="#9cc2cb" strokeWidth="9" strokeLinecap="round" fill="none" />
            </>
          )}

          {/* Future development */}
          {on("future") &&
            ds.futureSites.map((f) => (
              <g key={f.id}>
                <polygon points={pts(f.footprint)} fill="url(#hatch-future)" stroke="#b3413b" strokeWidth="0.8" />
                <text
                  x={f.footprint[0].x + 4}
                  y={f.footprint[0].y + (f.id === "landed-south-zone" ? 26 : 24)}
                  fontSize="9"
                  className="font-display-normal"
                  fill="#8f2f2a"
                >
                  {f.risk} future risk
                </text>
              </g>
            ))}

          {/* Walking routes */}
          {on("routes") && (
            <g>
              {ds.internalRoutes.map((r, i) => {
                const mine = r.blockId === selectedStack.blockId;
                return (
                  <polyline
                    key={i}
                    points={pts(r.path)}
                    fill="none"
                    stroke="#1d7a4f"
                    strokeWidth={mine ? 2.4 : 1}
                    strokeOpacity={mine ? (r.gateId === bestGate ? 1 : 0.45) : 0.2}
                    strokeDasharray={mine && r.gateId === bestGate ? undefined : "4 3"}
                  />
                );
              })}
              {ds.externalRoutes.map((r) => (
                <polyline
                  key={r.gateId}
                  points={pts(r.path)}
                  fill="none"
                  stroke="#1d7a4f"
                  strokeWidth={r.gateId === bestGate ? 2.4 : 1.2}
                  strokeOpacity={r.gateId === bestGate ? 1 : 0.4}
                  markerEnd="url(#arrow)"
                  color="#1d7a4f"
                />
              ))}
              {ds.project.display?.mrtLabel && (
                <text
                  x={Math.min(ds.project.display.mrtLabel.at.x, VIEWBOX.x + VIEWBOX.w - 8)}
                  y={ds.project.display.mrtLabel.at.y + 14}
                  textAnchor="end"
                  fontSize="10"
                  fill="#1d7a4f"
                  className="font-display-normal"
                >
                  {ds.project.display.mrtLabel.text}
                </text>
              )}
              {ds.gates.map((g) => (
                <g key={g.id}>
                  <rect x={g.position.x - 5} y={g.position.y - 5} width="10" height="10" fill="#1d7a4f" />
                  <text x={g.position.x + 8} y={g.position.y - 7} fontSize="9" fill="#1d7a4f" className="font-display-normal">
                    {g.id === "main" ? "Main gate" : "South gate"}
                  </text>
                </g>
              ))}
            </g>
          )}

          {/* Noise sources */}
          {on("noise") && (
            <g>
              {ds.exposureSources
                .filter((s) => s.kind !== "expressway" && s.kind !== "main-road")
                .map((s) => {
                  const c = s.geometry[s.geometry.length - 1];
                  return (
                    <g key={s.id}>
                      <circle cx={c.x} cy={c.y} r="6" fill="#7b3f9b" fillOpacity="0.15" stroke="#7b3f9b" />
                      <text x={c.x + 9} y={c.y + 3} fontSize="8.5" fill="#5d2d78" className="font-display-normal">
                        {s.name.split(" ").slice(0, 2).join(" ")}
                      </text>
                    </g>
                  );
                })}
              {assessment?.exposure.noise.map((n) => (
                <line
                  key={n.source.id}
                  x1={selectedStack.position.x}
                  y1={selectedStack.position.y}
                  x2={n.point.x}
                  y2={n.point.y}
                  stroke={POTENTIAL_COLOUR[n.potential]}
                  strokeWidth="1.6"
                  strokeDasharray={n.lineOfSight === "screened" ? "3 3" : undefined}
                />
              ))}
            </g>
          )}

          {/* View rays for the selected stack */}
          {on("views") &&
            view.rays.map((r, i) =>
              r.targetDistance === null ? null : (
                <line
                  key={i}
                  x1={selectedStack.position.x}
                  y1={selectedStack.position.y}
                  x2={along(selectedStack.position, r.bearingDeg, r.targetDistance).x}
                  y2={along(selectedStack.position, r.bearingDeg, r.targetDistance).y}
                  stroke="#2e6a78"
                  strokeWidth={r.offsetDeg === 0 ? 1.8 : 0.9}
                  strokeOpacity={0.75}
                  strokeDasharray={r.offsetDeg === 0 ? undefined : "5 4"}
                />
              ),
            )}

          {/* Privacy lines */}
          {on("privacy") &&
            assessment?.exposure.privacy
              .filter((p) => p.distanceM !== null)
              .map((p, i) => {
                const bearing =
                  p.room === "Living room" ? selectedStack.livingBearingDeg : selectedStack.masterBearingDeg;
                const end = along(selectedStack.position, bearing, p.distanceM!);
                return (
                  <g key={i}>
                    <line
                      x1={selectedStack.position.x}
                      y1={selectedStack.position.y}
                      x2={end.x}
                      y2={end.y}
                      stroke="#3f5c9a"
                      strokeWidth="2"
                      strokeDasharray={p.kind === "overlooks-roof" ? "2 3" : undefined}
                    />
                    <text x={(selectedStack.position.x + end.x) / 2 + 4} y={(selectedStack.position.y + end.y) / 2} fontSize="9" fill="#3f5c9a" className="font-display-normal">
                      {p.distanceM} m
                    </text>
                  </g>
                );
              })}

          {/* Blocks */}
          {ds.obstructions
            .filter((o) => o.kind === "own-block")
            .map((o) => {
              const block = engine.ix.block(o.blockId!);
              return (
                <g key={o.id}>
                  <polygon points={pts(o.footprint)} fill={planImage ? "none" : "#dfe6dc"} stroke="#10291c" strokeWidth={planImage ? 0.5 : 1} strokeDasharray={planImage ? "2 2" : undefined} />
                  <text
                    x={block.centre.x}
                    y={Math.max(...o.footprint.map((p) => p.y)) + 17}
                    textAnchor="middle"
                    fontSize="8"
                    className="fill-canopy font-display-normal"
                    fontWeight="600"
                  >
                    {block.name}, {block.storeys} storeys
                  </text>
                </g>
              );
            })}

          {/* Stacks */}
          {ds.stacks.map((s) => {
            const selected = s.id === selectedStackId;
            const u = on("sun") ? unitNear(s.id) : null;
            const sunMin = u ? engine.sunProvider.estimate(u).living.annualAverageMin : 0;
            const tip = along(s.position, s.livingBearingDeg, (selected ? 16 : 11) * (dense ? 0.6 : 1));
            const layout = engine.ix.stackLayout(s.id);
            return (
              <g
                key={s.id}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                aria-label={`Stack ${s.id}, ${engine.ix.block(s.blockId).name}, ${layout.name}, ${layout.bedrooms} bedrooms, living room faces ${compassPoint(s.livingBearingDeg)}`}
                onClick={() => onSelectStack(s.id)}
                onKeyDown={activateOnKey(s.id)}
                className="cursor-pointer focus:outline-none [&:focus-visible>circle]:stroke-reservoir [&:focus-visible>circle]:stroke-[3]"
              >
                <line
                  x1={s.position.x}
                  y1={s.position.y}
                  x2={tip.x}
                  y2={tip.y}
                  stroke={selected ? "#10291c" : "#6f7a71"}
                  strokeWidth={selected ? 2 : 1.2}
                  markerEnd="url(#arrow)"
                  color={selected ? "#10291c" : "#6f7a71"}
                />
                <circle
                  cx={s.position.x}
                  cy={s.position.y}
                  r={selected ? markerR + 1.5 : markerR}
                  fill={on("sun") ? sunColour(sunMin) : selected ? "#10291c" : "#ffffff"}
                  stroke="#10291c"
                  strokeWidth={selected ? 2.5 : 1}
                />
                <text
                  x={s.position.x}
                  y={s.position.y + 3}
                  textAnchor="middle"
                  fontSize={dense ? 4.4 : 6.5}
                  fontWeight="700"
                  className="pointer-events-none font-display-normal"
                  fill={selected && !on("sun") ? "#edf0ea" : "#10291c"}
                >
                  {s.id}
                </text>
              </g>
            );
          })}

          {/* Sun direction */}
          {on("sun") && sun.altitudeDeg > 0 && (
            <g color="#c88a12">
              <line
                x1={along(siteCentre, sun.azimuthDeg, sunReach).x}
                y1={along(siteCentre, sun.azimuthDeg, sunReach).y}
                x2={along(siteCentre, sun.azimuthDeg, sunReach * 0.63).x}
                y2={along(siteCentre, sun.azimuthDeg, sunReach * 0.63).y}
                stroke="#c88a12"
                strokeWidth="2.5"
                markerEnd="url(#arrow)"
              />
              <circle
                cx={along(siteCentre, sun.azimuthDeg, sunReach * 1.07).x}
                cy={along(siteCentre, sun.azimuthDeg, sunReach * 1.07).y}
                r="9"
                fill="#f2c14e"
              />
            </g>
          )}

          {/* Obstruction heights, drawn last so roads never cover them */}
          {on("views") &&
            ds.obstructions
              .filter((o) => o.kind !== "own-block" && o.kind !== "landed-housing")
              .map((o) => {
                const xs = o.footprint.map((p) => p.x);
                const ys = o.footprint.map((p) => p.y);
                const x = Math.max(Math.min(...xs), VIEWBOX.x) + 4;
                const y = Math.max(Math.min(...ys), VIEWBOX.y + 20) + 12;
                return (
                  <text
                    key={o.id}
                    x={x}
                    y={y}
                    fontSize="9"
                    className="fill-canopy font-display-normal"
                  >
                    top {Math.round(o.topRL.min)}
                    {o.topRL.max !== o.topRL.min ? `–${Math.round(o.topRL.max)}` : ""} m
                  </text>
                );
              })}

          {/* North arrow and scale */}
          <g transform={`translate(${VIEWBOX.x + VIEWBOX.w - 34} ${VIEWBOX.y + 36}) rotate(${-ds.project.planNorthDeg})`}>
            <circle r="17" fill="#ffffff" stroke="#10291c" strokeWidth="0.8" />
            <path d="M0,-13 L6,6 L0,2 L-6,6 z" fill="#10291c" />
            <text y="-19" textAnchor="middle" fontSize="10" fontWeight="700" className="fill-canopy font-display-normal">
              N
            </text>
          </g>
          <g transform={`translate(${VIEWBOX.x + 14} ${VIEWBOX.y + VIEWBOX.h - 16})`}>
            <line x1="0" y1="0" x2="100" y2="0" stroke="#10291c" strokeWidth="1.5" />
            <line x1="0" y1="-4" x2="0" y2="4" stroke="#10291c" />
            <line x1="50" y1="-3" x2="50" y2="3" stroke="#10291c" />
            <line x1="100" y1="-4" x2="100" y2="4" stroke="#10291c" />
            <text x="0" y="-7" fontSize="9" className="fill-canopy font-display-normal">0</text>
            <text x="100" y="-7" fontSize="9" textAnchor="middle" className="fill-canopy font-display-normal">100 m</text>
          </g>
          <text x={VIEWBOX.x + VIEWBOX.w - 10} y={VIEWBOX.y + VIEWBOX.h - 10} textAnchor="end" fontSize="9" className="fill-stone font-display-normal">
            {planImage ? planImage.credit : "Illustrative plan, not to scale of any real site"}
          </text>
        </svg>
      </div>

      <PlanLegend overlays={overlays} month={month} minutes={minutes} sunAltitude={sun.altitudeDeg} sunAzimuth={sun.azimuthDeg} />
    </div>
  );
}

function Swatch({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <svg width="22" height="12" aria-hidden="true" className="shrink-0">
        {children}
      </svg>
      {label}
    </li>
  );
}

function PlanLegend({
  overlays,
  month,
  minutes,
  sunAltitude,
  sunAzimuth,
}: {
  overlays: Set<Overlay>;
  month: number;
  minutes: number;
  sunAltitude: number;
  sunAzimuth: number;
}) {
  return (
    <ul className="mt-3 grid gap-x-6 gap-y-1.5 font-display-normal text-sm text-canopy/80 sm:grid-cols-2">
      <Swatch label="Stack (arrow shows living-room facing)">
        <circle cx="6" cy="6" r="5" fill="#fff" stroke="#10291c" />
        <line x1="11" y1="6" x2="21" y2="6" stroke="#6f7a71" strokeWidth="1.5" />
      </Swatch>
      <Swatch label="Existing building / tree belt">
        <rect x="0" y="1" width="10" height="10" fill="#d4d9d3" />
        <rect x="12" y="1" width="10" height="10" fill="#bcd1b3" />
      </Swatch>
      {overlays.has("sun") && (
        <li className="sm:col-span-2">
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-3 w-16 rounded-sm"
              style={{ background: "linear-gradient(90deg, rgb(250,240,214), rgb(214,132,18))" }}
            />
            Average afternoon sun on the living room: none to 4 h+ (illustrative)
          </span>
          <span className="mt-0.5 block text-stone">
            {sunAltitude > 0
              ? `Sun on 21 ${MONTHS[month]} at ${formatClock(minutes)}: from the ${compassPoint(sunAzimuth)}, ${Math.round(sunAltitude)}° above the horizon.`
              : `The sun is down on 21 ${MONTHS[month]} at ${formatClock(minutes)}.`}
          </span>
        </li>
      )}
      {overlays.has("views") && (
        <Swatch label="Sight lines tested for the selected stack">
          <line x1="0" y1="6" x2="22" y2="6" stroke="#2e6a78" strokeWidth="2" />
        </Swatch>
      )}
      {overlays.has("noise") && (
        <Swatch label="Noise source; line darker for higher potential, dashed if screened">
          <circle cx="6" cy="6" r="5" fill="#7b3f9b" fillOpacity="0.15" stroke="#7b3f9b" />
          <line x1="12" y1="6" x2="22" y2="6" stroke="#7b3f9b" strokeWidth="2" />
        </Swatch>
      )}
      {overlays.has("privacy") && (
        <Swatch label="Line of sight to neighbouring windows (dotted: over the roof)">
          <line x1="0" y1="6" x2="22" y2="6" stroke="#3f5c9a" strokeWidth="2" />
        </Swatch>
      )}
      {overlays.has("routes") && (
        <Swatch label="Walking route; solid is the quickest for this block">
          <rect x="0" y="1" width="9" height="9" fill="#1d7a4f" />
          <line x1="11" y1="6" x2="22" y2="6" stroke="#1d7a4f" strokeWidth="2" />
        </Swatch>
      )}
      {overlays.has("future") && (
        <Swatch label="Potential future development area">
          <rect x="0" y="0" width="22" height="12" fill="url(#hatch-future)" stroke="#b3413b" />
        </Swatch>
      )}
    </ul>
  );
}
