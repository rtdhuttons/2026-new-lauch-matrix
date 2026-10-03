"use client";

// Shared charts: plain SVG sized to its container, with a hover/focus
// tooltip on every mark and an optional "Show the numbers" table, so no value
// depends on hovering or on colour alone.
//
// Colours were checked for colour-blind separation and contrast on white
// (series order is fixed: the project itself is always the first colour).

import { useEffect, useRef, useState, type ReactNode } from "react";

export const SERIES = ["#0b7f9e", "#c77a12", "#7a4fb5", "#d0457a", "#5b8f22"] as const;
export const INK = "#10291c";
export const MUTED = "#6f7a71";
const GRID = "#e3e7e1";
const DOWN = "#b3532e";
const FONT = "var(--font-display), system-ui, sans-serif";

export type Fmt = (n: number) => string;

export const fmtMoney: Fmt = (n) => `${n < 0 ? "−" : ""}S$${Math.abs(Math.round(n)).toLocaleString("en-SG")}`;
export const fmtMoneyShort: Fmt = (n) => {
  const a = Math.abs(n);
  const s = n < 0 ? "−" : "";
  if (a >= 1_000_000) return `${s}S$${(a / 1_000_000).toFixed(a >= 10_000_000 ? 1 : 2)}M`;
  if (a >= 1_000) return `${s}S$${Math.round(a / 1_000)}k`;
  return `${s}S$${Math.round(a)}`;
};

// Starts narrow so a chart never widens its container before measuring it.
function useWidth(initial = 300) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Clean axis ticks: about `count` round numbers covering [lo, hi]. */
export function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (hi === lo) hi = lo + 1;
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const start = Math.floor(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v <= hi + step * 0.001; v += step) out.push(Math.round(v * 1e6) / 1e6);
  if (out[out.length - 1] < hi) out.push(out[out.length - 1] + step);
  return out;
}

/** Keeps end tick labels inside the chart: start-aligned at the left edge, end-aligned at the right. */
function tickAnchor(x: number, left: number, right: number): "start" | "middle" | "end" {
  if (x - left < 22) return "start";
  if (right - x < 22) return "end";
  return "middle";
}

interface TipState {
  x: number;
  y: number;
  content: ReactNode;
}

function Tooltip({ tip, width }: { tip: TipState | null; width: number }) {
  if (!tip) return null;
  const left = tip.x > width - 190 ? tip.x - 12 : tip.x + 12;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 min-w-[150px] max-w-[240px] rounded-lg border border-canopy/15 bg-paper px-3 py-2 font-display-normal text-xs shadow-lg"
      style={{ left, top: Math.max(0, tip.y - 10), transform: tip.x > width - 190 ? "translateX(-100%)" : undefined }}
    >
      {tip.content}
    </div>
  );
}

/** One tooltip row: a short line key in the series colour, the value strong, the label after. */
export function TipRow({ color, value, label, dashed }: { color?: string; value: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      {color && <span aria-hidden="true" className="inline-block w-3 border-t-2" style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }} />}
      <strong className="tabular-nums text-canopy">{value}</strong>
      <span className="text-canopy/65">{label}</span>
    </div>
  );
}

export interface LegendItem {
  label: string;
  color: string;
  shape?: "line" | "rect" | "dot" | "band" | "dashed";
}

export function Legend({ items }: { items: LegendItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 font-display-normal text-xs text-canopy/75">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          {it.shape === "rect" || it.shape === "band" ? (
            <span aria-hidden="true" className="inline-block size-3 rounded-sm" style={{ background: it.color, opacity: it.shape === "band" ? 0.25 : 1 }} />
          ) : it.shape === "dot" ? (
            <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: it.color }} />
          ) : (
            <span aria-hidden="true" className="inline-block w-4 border-t-2" style={{ borderColor: it.color, borderStyle: it.shape === "dashed" ? "dashed" : "solid" }} />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/** Title, legend, the chart and an optional table of the same numbers. */
export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  note,
  children,
  className = "",
}: {
  title: string;
  subtitle?: ReactNode;
  legend?: LegendItem[];
  table?: { caption: string; columns: string[]; rows: (string | number)[][] };
  note?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={`min-w-0 rounded-xl border border-canopy/10 bg-paper p-4 sm:p-5 ${className}`}>
      <figcaption>
        <p className="font-display-normal text-base font-semibold">{title}</p>
        {subtitle && <p className="mt-0.5 text-sm text-canopy/70">{subtitle}</p>}
      </figcaption>
      {legend && legend.length > 1 && (
        <div className="mt-2">
          <Legend items={legend} />
        </div>
      )}
      <div className="mt-3">{children}</div>
      {note && <p className="mt-2 text-xs text-stone">{note}</p>}
      {table && (
        <details className="mt-2">
          <summary className="cursor-pointer font-display-normal text-sm font-semibold text-reservoir">Show the numbers</summary>
          <div className="relative mt-2 overflow-x-auto">
            <table className="w-full border-collapse font-display-normal text-sm tabular-nums">
              <caption className="sr-only">{table.caption}</caption>
              <thead>
                <tr className="text-left text-xs text-canopy/65">
                  {table.columns.map((c, i) => (
                    <th key={c} scope="col" className={`py-1.5 pr-3 font-semibold ${i > 0 ? "text-right" : ""}`}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, ri) => (
                  <tr key={ri} className="border-t border-canopy/10">
                    {r.map((c, i) =>
                      i === 0 ? (
                        <th key={i} scope="row" className="py-1.5 pr-3 text-left font-normal">
                          {c}
                        </th>
                      ) : (
                        <td key={i} className="py-1.5 pr-3 text-right">
                          {c}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}

// ---------------------------------------------------------------- Line chart

export interface LinePoint {
  x: number;
  y: number;
}
export interface LineSeries {
  id: string;
  label: string;
  color: string;
  points: LinePoint[];
  dashed?: boolean;
  /** Label the last value at the line's end. */
  endLabel?: boolean;
}

export function LineChart({
  series,
  band,
  xFormat,
  yFormat,
  height = 260,
  highlightX,
  ariaLabel,
  yFromZero = false,
  xTicks,
}: {
  series: LineSeries[];
  band?: { lower: LinePoint[]; upper: LinePoint[]; color: string; label: string };
  xFormat: Fmt;
  yFormat: Fmt;
  height?: number;
  /** Marks one x position (e.g. the selected floor). */
  highlightX?: number;
  ariaLabel: string;
  yFromZero?: boolean;
  xTicks?: number[];
}) {
  const [ref, width] = useWidth();
  const [hoverX, setHoverX] = useState<number | null>(null);
  const all = [...series.flatMap((s) => s.points), ...(band ? [...band.lower, ...band.upper] : [])];
  if (all.length === 0) return null;
  const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b);
  const xMin = Math.min(...all.map((p) => p.x));
  const xMax = Math.max(...all.map((p) => p.x));
  const yTicks = niceTicks(yFromZero ? 0 : Math.min(...all.map((p) => p.y)), Math.max(...all.map((p) => p.y)), height < 220 ? 3 : 4);
  const yMin = yTicks[0];
  const yMax = yTicks[yTicks.length - 1];
  const yLabelW = Math.max(...yTicks.map((t) => yFormat(t).length)) * 6.6 + 10;
  const endW = series.some((s) => s.endLabel) ? Math.min(92, width * 0.22) : 12;
  const m = { l: yLabelW, r: endW, t: 10, b: 26 };
  const pw = width - m.l - m.r;
  const ph = height - m.t - m.b;
  const sx = (x: number) => m.l + (xMax === xMin ? pw / 2 : ((x - xMin) / (xMax - xMin)) * pw);
  const sy = (y: number) => m.t + ph - ((y - yMin) / (yMax - yMin || 1)) * ph;
  const path = (pts: LinePoint[]) => pts.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join("");
  const ticksX = xTicks ?? (xs.length <= 8 ? xs : niceTicks(xMin, xMax, Math.max(3, Math.floor(pw / 80))).filter((t) => t >= xMin && t <= xMax));
  const nearest = (px: number) => xs.reduce((best, x) => (Math.abs(sx(x) - px) < Math.abs(sx(best) - px) ? x : best), xs[0]);

  const tipX = hoverX ?? null;
  const tip: TipState | null =
    tipX === null
      ? null
      : {
          x: sx(tipX),
          y: m.t,
          content: (
            <>
              <p className="mb-1 font-semibold text-canopy">{xFormat(tipX)}</p>
              {series.map((s) => {
                const p = s.points.find((q) => q.x === tipX);
                return p ? <TipRow key={s.id} color={s.color} dashed={s.dashed} value={yFormat(p.y)} label={s.label} /> : null;
              })}
              {band &&
                (() => {
                  const lo = band.lower.find((q) => q.x === tipX);
                  const hi = band.upper.find((q) => q.x === tipX);
                  return lo && hi ? <TipRow value={`${yFormat(lo.y)} – ${yFormat(hi.y)}`} label={band.label} /> : null;
                })()}
            </>
          ),
        };

  return (
    <div ref={ref} className="relative w-full min-w-0">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        className="block touch-pan-y outline-none focus-visible:outline-2 focus-visible:outline-reservoir"
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          setHoverX(nearest(e.clientX - r.left));
        }}
        onPointerLeave={() => setHoverX(null)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          const i = hoverX === null ? 0 : xs.indexOf(hoverX) + (e.key === "ArrowRight" ? 1 : -1);
          setHoverX(xs[Math.max(0, Math.min(xs.length - 1, i))]);
        }}
        onBlur={() => setHoverX(null)}
        style={{ fontFamily: FONT }}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={sy(t)} y2={sy(t)} stroke={GRID} strokeWidth={1} />
            <text x={m.l - 8} y={sy(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={MUTED} className="tabular-nums">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {ticksX.map((t) => (
          <text key={t} x={sx(t)} y={height - 8} textAnchor={tickAnchor(sx(t), 0, width)} fontSize={11} fill={MUTED} className="tabular-nums">
            {xFormat(t)}
          </text>
        ))}
        {band && (
          <path
            d={`${path(band.upper)}${[...band.lower].reverse().map((p) => `L${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join("")}Z`}
            fill={band.color}
            opacity={0.14}
          />
        )}
        {highlightX !== undefined && <line x1={sx(highlightX)} x2={sx(highlightX)} y1={m.t} y2={m.t + ph} stroke={INK} strokeOpacity={0.35} strokeWidth={1} />}
        {series.map((s) => (
          <path key={s.id} d={path(s.points)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? "5 4" : undefined} />
        ))}
        {series.map((s) => {
          const last = s.points[s.points.length - 1];
          return (
            <g key={`${s.id}-end`}>
              {highlightX !== undefined &&
                s.points
                  .filter((p) => p.x === highlightX)
                  .map((p) => <circle key="h" cx={sx(p.x)} cy={sy(p.y)} r={5} fill={s.color} stroke="#fff" strokeWidth={2} />)}
              {s.endLabel && last && (
                <>
                  <circle cx={sx(last.x)} cy={sy(last.y)} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
                  <text x={sx(last.x) + 8} y={sy(last.y)} dy="0.32em" fontSize={11} fontWeight={600} fill={INK} className="tabular-nums">
                    {yFormat(last.y)}
                  </text>
                </>
              )}
            </g>
          );
        })}
        {tipX !== null && (
          <g>
            <line x1={sx(tipX)} x2={sx(tipX)} y1={m.t} y2={m.t + ph} stroke={INK} strokeWidth={1} strokeOpacity={0.5} />
            {series.map((s) => {
              const p = s.points.find((q) => q.x === tipX);
              return p ? <circle key={s.id} cx={sx(p.x)} cy={sy(p.y)} r={4.5} fill={s.color} stroke="#fff" strokeWidth={2} /> : null;
            })}
          </g>
        )}
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

// ------------------------------------------------------- Horizontal bar chart

export interface BarDatum {
  id: string;
  label: string;
  value: number;
  color?: string;
  /** Lighter text under the label (e.g. "143 resales"). */
  sub?: string;
  /** A range drawn as a thin whisker over the bar (e.g. middle half). */
  range?: [number, number];
  /** Extra tooltip lines. */
  detail?: ReactNode;
  emphasis?: boolean;
}

export function BarChart({
  bars,
  format,
  ariaLabel,
  max,
  marker,
  rangeLabel,
}: {
  bars: BarDatum[];
  format: Fmt;
  ariaLabel: string;
  max?: number;
  marker?: { value: number; label: string };
  rangeLabel?: string;
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<string | null>(null);
  const narrow = width < 520;
  const labelW = narrow ? 0 : Math.min(200, width * 0.3);
  const valueW = Math.max(...bars.map((b) => format(b.value).length)) * 7 + 14;
  const rowH = narrow ? 50 : 38;
  const top = marker ? 18 : 4;
  const height = top + bars.length * rowH + 4;
  const hi = max ?? Math.max(...bars.map((b) => Math.max(b.value, b.range?.[1] ?? 0)), marker?.value ?? 0) * 1.02;
  const x0 = labelW;
  const pw = width - labelW - valueW;
  const sx = (v: number) => x0 + (Math.max(0, v) / (hi || 1)) * pw;
  const barH = 16;
  const hovered = bars.find((b) => b.id === hover);
  const hi_ = hovered ? bars.indexOf(hovered) : -1;

  return (
    <div ref={ref} className="relative w-full min-w-0">
      <svg width={width} height={height} role="img" aria-label={ariaLabel} style={{ fontFamily: FONT }} className="block">
        {marker && (
          <g>
            <line x1={sx(marker.value)} x2={sx(marker.value)} y1={top - 4} y2={height - 2} stroke={INK} strokeOpacity={0.55} strokeWidth={1} />
            <text x={sx(marker.value)} y={10} textAnchor="middle" fontSize={10.5} fill={INK}>
              {marker.label}
            </text>
          </g>
        )}
        {bars.map((b, i) => {
          const y = top + i * rowH + (narrow ? 22 : (rowH - barH) / 2);
          const w = Math.max(2, sx(b.value) - x0);
          const color = b.color ?? SERIES[0];
          return (
            <g
              key={b.id}
              tabIndex={0}
              aria-label={`${b.label}: ${format(b.value)}`}
              onPointerEnter={() => setHover(b.id)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(b.id)}
              onBlur={() => setHover(null)}
              className="outline-none"
            >
              <rect x={0} y={top + i * rowH} width={width} height={rowH} fill="transparent" />
              {narrow ? (
                <text x={0} y={top + i * rowH + 14} fontSize={12} fontWeight={b.emphasis ? 700 : 500} fill={INK}>
                  {b.label}
                  {b.sub && (
                    <tspan fill={MUTED} fontWeight={400}>
                      {"  "}
                      {b.sub}
                    </tspan>
                  )}
                </text>
              ) : (
                <>
                  <text x={labelW - 10} y={y + barH / 2 - (b.sub ? 5 : 0)} dy="0.32em" textAnchor="end" fontSize={12} fontWeight={b.emphasis ? 700 : 500} fill={INK}>
                    {b.label}
                  </text>
                  {b.sub && (
                    <text x={labelW - 10} y={y + barH / 2 + 9} dy="0.32em" textAnchor="end" fontSize={10.5} fill={MUTED}>
                      {b.sub}
                    </text>
                  )}
                </>
              )}
              <path
                d={`M${x0},${y} h${Math.max(0, w - 4)} a4,4 0 0 1 4,4 v${barH - 8} a4,4 0 0 1 -4,4 h${-Math.max(0, w - 4)} Z`}
                fill={color}
                opacity={hover && hover !== b.id ? 0.55 : 1}
              />
              {b.range && (
                <g stroke={INK} strokeWidth={1.5}>
                  <line x1={sx(b.range[0])} x2={sx(b.range[1])} y1={y + barH / 2} y2={y + barH / 2} />
                  <line x1={sx(b.range[0])} x2={sx(b.range[0])} y1={y + 3} y2={y + barH - 3} />
                  <line x1={sx(b.range[1])} x2={sx(b.range[1])} y1={y + 3} y2={y + barH - 3} />
                </g>
              )}
              <text x={Math.max(sx(b.value), b.range ? sx(b.range[1]) : 0) + 6} y={y + barH / 2} dy="0.32em" fontSize={12} fontWeight={600} fill={INK} className="tabular-nums">
                {format(b.value)}
              </text>
            </g>
          );
        })}
      </svg>
      {hovered && (
        <Tooltip
          width={width}
          tip={{
            x: Math.min(sx(hovered.value), width - 40),
            y: top + hi_ * rowH + rowH,
            content: (
              <>
                <p className="mb-1 font-semibold text-canopy">{hovered.label}</p>
                <TipRow color={hovered.color ?? SERIES[0]} value={format(hovered.value)} label={hovered.sub ?? ""} />
                {hovered.range && <TipRow value={`${format(hovered.range[0])} – ${format(hovered.range[1])}`} label={rangeLabel ?? "range"} />}
                {hovered.detail}
              </>
            ),
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Waterfall

export interface WaterfallStep {
  label: string;
  /** For "total" steps, the running total to show; for "change", the change. */
  value: number;
  kind: "total" | "change";
}

/** Where each column starts and ends: totals from zero, changes from the running total. */
export function waterfallColumns(steps: WaterfallStep[]) {
  const cols: (WaterfallStep & { from: number; to: number })[] = [];
  let run = 0;
  for (const s of steps) {
    const from = s.kind === "total" ? 0 : run;
    run = s.kind === "total" ? s.value : run + s.value;
    cols.push({ ...s, from, to: run });
  }
  return cols;
}

export function Waterfall({ steps, format, ariaLabel, height = 260 }: { steps: WaterfallStep[]; format: Fmt; ariaLabel: string; height?: number }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const cols = waterfallColumns(steps);
  const lo = Math.min(0, ...cols.map((c) => Math.min(c.from, c.to)));
  const ticks = niceTicks(lo, Math.max(...cols.map((c) => Math.max(c.from, c.to))), 4);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const narrow = width < 520;
  const m = { l: Math.max(...ticks.map((t) => format(t).length)) * 6.4 + 10, r: 8, t: 18, b: narrow ? 40 : 30 };
  const pw = width - m.l - m.r;
  const ph = height - m.t - m.b;
  const slot = pw / cols.length;
  const bw = Math.min(narrow ? 30 : 44, slot * 0.6);
  const sy = (v: number) => m.t + ph - ((v - yMin) / (yMax - yMin || 1)) * ph;

  return (
    <div ref={ref} className="relative w-full min-w-0">
      <svg width={width} height={height} role="img" aria-label={ariaLabel} style={{ fontFamily: FONT }} className="block">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? MUTED : GRID} strokeWidth={1} />
            <text x={m.l - 8} y={sy(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={MUTED} className="tabular-nums">
              {format(t)}
            </text>
          </g>
        ))}
        {cols.map((c, i) => {
          const cx = m.l + slot * i + slot / 2;
          const y1 = sy(Math.max(c.from, c.to));
          const y2 = sy(Math.min(c.from, c.to));
          const color = c.kind === "total" ? (c.to < 0 ? DOWN : INK) : c.value < 0 ? DOWN : SERIES[0];
          const words = c.label.split(" ");
          const lines = narrow && words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [c.label];
          return (
            <g
              key={i}
              tabIndex={0}
              aria-label={`${c.label}: ${format(c.kind === "total" ? c.to : c.value)}`}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="outline-none"
            >
              <rect x={cx - slot / 2} y={m.t} width={slot} height={ph} fill="transparent" />
              <rect x={cx - bw / 2} y={y1} width={bw} height={Math.max(2, y2 - y1)} rx={3} fill={color} opacity={hover !== null && hover !== i ? 0.55 : 1} />
              {i < cols.length - 1 && <line x1={cx + bw / 2} x2={cx + slot - bw / 2} y1={sy(c.to)} y2={sy(c.to)} stroke={MUTED} strokeDasharray="2 2" />}
              <text x={cx} y={y1 - 5} textAnchor="middle" fontSize={narrow ? 10 : 11} fontWeight={600} fill={INK} className="tabular-nums">
                {c.kind === "change" && c.value > 0 ? "+" : ""}
                {format(c.kind === "total" ? c.to : c.value)}
              </text>
              {lines.map((l, li) => (
                <text key={li} x={cx} y={height - m.b + 14 + li * 12} textAnchor="middle" fontSize={narrow ? 10 : 11} fill={MUTED}>
                  {l}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <Tooltip
          width={width}
          tip={{
            x: m.l + slot * hover + slot / 2,
            y: sy(Math.max(cols[hover].from, cols[hover].to)),
            content: (
              <>
                <p className="mb-1 font-semibold text-canopy">{cols[hover].label}</p>
                <TipRow value={format(cols[hover].kind === "total" ? cols[hover].to : cols[hover].value)} label={cols[hover].kind === "total" ? "total" : "change"} />
                {cols[hover].kind === "change" && <TipRow value={format(cols[hover].to)} label="after this step" />}
              </>
            ),
          }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------------- Scatter

export interface ScatterPoint {
  id: string;
  x: number;
  y: number;
  group: string;
  label: string;
  /** Hollow marker, e.g. for an estimate. */
  hollow?: boolean;
  detail?: ReactNode;
}

export function ScatterChart({
  points,
  groups,
  xFormat,
  yFormat,
  ariaLabel,
  height = 300,
  xTitle,
  yTitle,
}: {
  points: ScatterPoint[];
  groups: { id: string; color: string }[];
  xFormat: Fmt;
  yFormat: Fmt;
  ariaLabel: string;
  height?: number;
  xTitle: string;
  yTitle: string;
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<string | null>(null);
  if (points.length === 0) return null;
  const xt = niceTicks(Math.min(...points.map((p) => p.x)), Math.max(...points.map((p) => p.x)), 4);
  const yt = niceTicks(Math.min(...points.map((p) => p.y)), Math.max(...points.map((p) => p.y)), 4);
  const m = { l: Math.max(...yt.map((t) => yFormat(t).length)) * 6.4 + 12, r: 14, t: 18, b: 40 };
  const pw = width - m.l - m.r;
  const ph = height - m.t - m.b;
  const sx = (x: number) => m.l + ((x - xt[0]) / (xt[xt.length - 1] - xt[0] || 1)) * pw;
  const sy = (y: number) => m.t + ph - ((y - yt[0]) / (yt[yt.length - 1] - yt[0] || 1)) * ph;
  const color = (g: string) => groups.find((x) => x.id === g)?.color ?? MUTED;
  const hp = points.find((p) => p.id === hover);

  return (
    <div ref={ref} className="relative w-full min-w-0">
      <svg width={width} height={height} role="img" aria-label={ariaLabel} style={{ fontFamily: FONT }} className="block">
        <text x={m.l} y={10} fontSize={11} fill={MUTED}>
          {yTitle}
        </text>
        {yt.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={sy(t)} y2={sy(t)} stroke={GRID} />
            <text x={m.l - 8} y={sy(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={MUTED} className="tabular-nums">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {xt.map((t) => (
          <text key={t} x={sx(t)} y={m.t + ph + 16} textAnchor={tickAnchor(sx(t), 0, width)} fontSize={11} fill={MUTED} className="tabular-nums">
            {xFormat(t)}
          </text>
        ))}
        <text x={m.l + pw} y={height - 4} textAnchor="end" fontSize={11} fill={MUTED}>
          {xTitle}
        </text>
        {points.map((p) => (
          <g
            key={p.id}
            tabIndex={0}
            aria-label={`${p.label}: ${xFormat(p.x)}, ${yFormat(p.y)}`}
            onPointerEnter={() => setHover(p.id)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(p.id)}
            onBlur={() => setHover(null)}
            className="outline-none"
          >
            <circle cx={sx(p.x)} cy={sy(p.y)} r={12} fill="transparent" />
            <circle
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={hover === p.id ? 7 : 5.5}
              fill={p.hollow ? "#fff" : color(p.group)}
              stroke={p.hollow ? color(p.group) : "#fff"}
              strokeWidth={p.hollow ? 2.5 : 2}
            />
          </g>
        ))}
      </svg>
      {hp && (
        <Tooltip
          width={width}
          tip={{
            x: sx(hp.x),
            y: sy(hp.y) + 8,
            content: (
              <>
                <p className="mb-1 font-semibold text-canopy">{hp.label}</p>
                <TipRow color={color(hp.group)} value={yFormat(hp.y)} label={yTitle.toLowerCase()} />
                <TipRow value={xFormat(hp.x)} label={xTitle.toLowerCase()} />
                {hp.detail}
              </>
            ),
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------- One-bar composition

export interface Segment {
  label: string;
  value: number;
  color: string;
}

/** A single bar split into parts, with a legend that carries each value. */
export function SplitBar({ segments, format, ariaLabel }: { segments: Segment[]; format: Fmt; ariaLabel: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0);
  if (total <= 0) return null;
  return (
    <div>
      <div role="img" aria-label={ariaLabel} className="flex h-6 w-full gap-[2px] overflow-hidden rounded-md">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div
              key={s.label}
              title={`${s.label}: ${format(s.value)}`}
              onPointerEnter={() => setHover(s.label)}
              onPointerLeave={() => setHover(null)}
              style={{ width: `${(s.value / total) * 100}%`, background: s.color, opacity: hover && hover !== s.label ? 0.55 : 1 }}
            />
          ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-display-normal text-sm">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5 whitespace-nowrap">
            <span aria-hidden="true" className="inline-block size-3 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="text-canopy/75">{s.label}</span>
            <strong className="tabular-nums">{format(s.value)}</strong>
            <span className="text-xs text-canopy/55">{Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
