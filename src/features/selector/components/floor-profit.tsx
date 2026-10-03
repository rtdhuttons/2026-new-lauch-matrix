"use client";

import { useMemo, useState } from "react";
import type { ComparableEvidence } from "../model/project";
import type { ComparableTransaction } from "../model/types";
import { bandStats, likeForLike, median, profitTrend } from "../lib/comparable";
import { AssetImg } from "./asset-image";
import { BarChart, ChartCard, fmtMoneyShort, SERIES, TipRow } from "./charts";
import { BEDROOM_COLOURS, card, Disclosure } from "./ui";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-SG")}`;
const thousands = (n: number) =>
  Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000).toLocaleString("en-SG")}K`;
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
/** Bedroom counts outside the palette (e.g. 1-bedrooms) get a neutral grey. */
const dotColour = (b: number) => BEDROOM_COLOURS[b] ?? "#8a948b";

function Scatter({ txs }: { txs: ComparableTransaction[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 760;
  const H = 400;
  const pad = { l: 64, r: 16, t: 14, b: 40 };
  const maxFloor = Math.max(...txs.map((t) => t.floor));
  const yMax = Math.ceil(Math.max(...txs.map((t) => t.profit)) / 300_000) * 300_000;
  const x = (f: number) => pad.l + ((f - 0.5) / maxFloor) * (W - pad.l - pad.r);
  const y = (p: number) => pad.t + (1 - Math.max(0, p) / yMax) * (H - pad.t - pad.b);
  const maxArea = Math.max(...txs.map((t) => t.areaSqft));
  const r = (a: number) => 3 + 12 * Math.sqrt(a / maxArea);
  // Spread same-floor dots a little so they don't sit in one column.
  const jitter = (i: number) => (((i * 7919) % 100) / 100 - 0.5) * 0.7;
  const med = median(txs.map((t) => t.profit));
  const trend = profitTrend(txs);
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax; v += 300_000) yTicks.push(v);
  const drawn = txs.map((t, i) => ({ t, i, cx: x(t.floor + jitter(i)), cy: y(t.profit), rr: r(t.areaSqft) }));
  // Largest first, so small homes sit on top and stay visible.
  drawn.sort((a, b) => b.rr - a.rr);
  const h = hover !== null ? drawn.find((d) => d.i === hover) : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Gross profit of ${txs.length} resales by floor. Median ${thousands(med)}; the trend rises about ${thousands(trend.slope)} a floor. Figures by band are in the table above.`}
        onMouseLeave={() => setHover(null)}
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#10291c" strokeOpacity="0.08" />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#6f7a71">
              {v === 0 ? "$0" : `$${(v / 1_000_000).toFixed(1)}M`}
            </text>
          </g>
        ))}
        {Array.from({ length: Math.floor(maxFloor / 2) }, (_, k) => (k + 1) * 2).map((f) => (
          <text key={f} x={x(f)} y={H - pad.b + 18} textAnchor="middle" fontSize="11" fill="#6f7a71">
            {f}
          </text>
        ))}
        <text x={(pad.l + W - pad.r) / 2} y={H - 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="#10291c">
          Floor
        </text>
        {drawn.map((d) => (
          <circle
            key={d.i}
            cx={d.cx}
            cy={d.cy}
            r={d.rr}
            fill={dotColour(d.t.bedrooms)}
            fillOpacity={hover === null || hover === d.i ? 0.78 : 0.25}
            stroke="#ffffff"
            strokeWidth="1.5"
            onMouseEnter={() => setHover(d.i)}
          />
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(med)} y2={y(med)} stroke="#b3532e" strokeWidth="2" strokeDasharray="6 4" />
        <text x={pad.l + 6} y={y(med) + 16} fontSize="11" fontWeight="600" fill="#8f3f22">
          Median {thousands(med)}
        </text>
        <line
          x1={x(1)}
          x2={x(maxFloor)}
          y1={y(trend.intercept + trend.slope)}
          y2={y(trend.intercept + trend.slope * maxFloor)}
          stroke="#10291c"
          strokeWidth="2"
          strokeDasharray="2 4"
          strokeLinecap="round"
        />
      </svg>
      {h && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-canopy px-2.5 py-1.5 font-display-normal text-[0.8125rem] leading-snug text-mist shadow-lg"
          style={{ left: `${(h.cx / W) * 100}%`, top: `${((h.cy - h.rr - 4) / H) * 100}%` }}
        >
          <strong className="font-semibold">Level {h.t.floor}</strong>, {h.t.bedrooms}-bedroom, {h.t.areaSqft.toLocaleString("en-SG")} sq ft
          <br />
          Profit {money(h.t.profit)} over {h.t.holdingYears} years ({pct(h.t.annualised)} a year)
        </div>
      )}
    </div>
  );
}

/** How floor height paid off at a comparable development. */
const asAt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function FloorProfit({ evidence, subjectName }: { evidence: ComparableEvidence; subjectName: string }) {
  const project = evidence.project;
  const txs = project.transactions;
  const stats = useMemo(() => bandStats(txs), [txs]);
  const top = stats.reduce((a, b) => (b.avgProfit > a.avgProfit ? b : a));
  const low = stats[0];
  const lfl = useMemo(() => likeForLike(txs, 4), [txs]);
  const counts = [1, 2, 3, 4, 5].map((b) => ({ b, n: txs.filter((t) => t.bedrooms === b).length })).filter((c) => c.n > 0);
  const trend = profitTrend(txs);

  return (
    <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 [&>*]:min-w-0">
        <ChartCard title="Average resale profit by floor band" subtitle={`${project.name}: sale price minus purchase price, before costs`}>
          <BarChart
            ariaLabel={`Average resale profit by floor band at ${project.name}`}
            format={fmtMoneyShort}
            bars={stats.map((b) => ({
              id: b.band,
              label: `${b.label} ${b.floors}`,
              sub: `${b.homes} resales`,
              value: b.avgProfit,
              color: b.band === top.band ? SERIES[0] : "#9cc2cb",
              emphasis: b.band === top.band,
              detail: <TipRow value={fmtMoneyShort(b.medianProfit)} label="median profit" />,
            }))}
          />
        </ChartCard>
        <ChartCard title="Yearly return by floor band" subtitle="Average gain a year over each owner's holding period">
          <BarChart
            ariaLabel={`Average yearly return by floor band at ${project.name}`}
            format={(n) => `${(n * 100).toFixed(1)}%`}
            bars={stats.map((b) => ({
              id: b.band,
              label: `${b.label} ${b.floors}`,
              sub: `+${money(b.psfGain)} psf`,
              value: b.annualised,
              color: b.band === top.band ? SERIES[0] : "#9cc2cb",
              emphasis: b.band === top.band,
            }))}
          />
        </ChartCard>
      </div>
      <div className={`${card} overflow-hidden p-0`}>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse font-display-normal text-sm tabular-nums">
            <caption className="sr-only">Resale profit at {project.name} by floor band</caption>
            <thead>
              <tr className="bg-canopy text-left text-xs uppercase tracking-[0.08em] text-mist">
                <th scope="col" className="px-5 py-3.5 font-semibold">Floor band</th>
                <th scope="col" className="px-4 py-3.5 text-right font-semibold">Homes</th>
                <th scope="col" className="px-4 py-3.5 text-right font-semibold">Avg profit</th>
                <th scope="col" className="px-4 py-3.5 text-right font-semibold">Median profit</th>
                <th scope="col" className="px-4 py-3.5 text-right font-semibold">PSF gain</th>
                <th scope="col" className="px-5 py-3.5 text-right font-semibold">A year</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((b) => {
                const isTop = b.band === top.band;
                return (
                  <tr key={b.band} className={`border-t border-canopy/10 ${isTop ? "bg-[#f8ead9] font-semibold" : ""}`}>
                    <th scope="row" className="px-5 py-3.5 text-left font-medium">
                      <span className="font-serif text-base">
                        {b.label} · {b.floors}
                      </span>
                      {isTop && <span className="ml-2 rounded-full bg-[#b3532e] px-2 py-0.5 text-xs font-bold text-white">Top</span>}
                    </th>
                    <td className="px-4 py-3.5 text-right">{b.homes}</td>
                    <td className="px-4 py-3.5 text-right">{money(b.avgProfit)}</td>
                    <td className="px-4 py-3.5 text-right">{money(b.medianProfit)}</td>
                    <td className="px-4 py-3.5 text-right">+{money(b.psfGain)}</td>
                    <td className="px-5 py-3.5 text-right">{pct(b.annualised)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {lfl && (
        <p className="max-w-[72ch] text-[1rem] text-canopy/85">
          It holds like for like too: a <strong>{lfl.bedrooms}-bedroom on #21 and up</strong> made {thousands(lfl.high.avgProfit)} on average (
          {pct(lfl.high.annualised)} a year), against {thousands(lfl.low.avgProfit)} on floors #01–#10. Same layout, higher floor, bigger gain.
        </p>
      )}

      <div className="rounded-2xl border-l-4 border-[#b3532e] bg-paper p-5 shadow-sm sm:p-6">
        <h3 className="font-serif text-lg font-semibold">The takeaway</h3>
        <p className="mt-2 max-w-[72ch] text-[1rem] leading-relaxed">
          {trend.slope > 0 ? (
            <>
              The trend rises with height, about {thousands(trend.slope)} more profit for each floor. The {top.label.toLowerCase()} floors ({top.floors}) returned about{" "}
              <strong>{thousands(top.avgProfit - low.avgProfit)} more on average</strong> than low floors.
            </>
          ) : (
            <>The trend does not rise with height here: about {thousands(trend.slope)} profit for each floor higher.</>
          )}
        </p>
        {trend.slope > 0 && top.band !== "low" && (
          <p className="mt-2 max-w-[72ch] text-[1rem] leading-relaxed">
            So at {project.name}, the premium for a higher floor came back to owners as stronger resale profit, on top of the better light, view and privacy while they lived there.
          </p>
        )}
        <p className="mt-2 text-sm text-stone">Historical figures from a comparable development; past performance does not guarantee future results.</p>
      </div>

      <Disclosure title="View comparable transactions" hint={`All ${txs.length} resales by floor, with the median and trend`}>
      <div className={`${card} p-4 sm:p-6`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-display-normal text-sm font-semibold">Each dot is one resale</p>
          <p className="font-display-normal text-sm text-stone">Bubble size = unit size</p>
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-display-normal text-sm text-canopy/85" aria-label="Legend">
          {counts.map((c) => (
            <li key={c.b} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-3 rounded-full" style={{ background: dotColour(c.b) }} />
              {c.b}-bedroom ({c.n})
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block w-5 border-t-2 border-dashed border-[#b3532e]" />
            Median
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block w-5 border-t-2 border-dotted border-canopy" />
            Trend
          </li>
        </ul>
        <div className="mt-3">
          <Scatter txs={txs} />
        </div>
      </div>

      </Disclosure>

      <Disclosure title={`Why ${project.name} is a fair guide to ${subjectName}`} hint="What the two projects have in common">
      <div>
        <p className="max-w-[72ch] text-[1rem] text-canopy/80">
          The two share the traits that shaped this floor pattern, so {project.name}&apos;s record is a reasonable guide to how {subjectName} may behave.
        </p>
        <div className={`${card} mt-4 overflow-hidden p-0`}>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse font-display-normal text-sm">
              <thead>
                <tr className="bg-canopy text-left text-xs uppercase tracking-[0.08em] text-mist">
                  <th scope="col" className="px-5 py-3.5 font-semibold">Shared trait</th>
                  <th scope="col" className="px-4 py-3.5 font-semibold">{project.name}</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">{subjectName}</th>
                </tr>
              </thead>
              <tbody>
                {evidence.relevance.map(({ trait, comparable: a, subject: b }) => (
                  <tr key={trait} className="border-t border-canopy/10 align-top">
                    <th scope="row" className="px-5 py-3 text-left font-semibold">
                      <span aria-hidden="true" className="mr-1.5 text-[#b3532e]">✓</span>
                      {trait}
                    </th>
                    <td className="px-4 py-3">{a}</td>
                    <td className="px-5 py-3">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {evidence.image && (
          <figure className="relative mt-4 overflow-hidden rounded-2xl bg-canopy">
            <AssetImg src={evidence.image.src} alt={evidence.image.alt} loading="lazy" className="aspect-[21/8] w-full object-cover" />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10 font-display-normal text-sm text-white">
              {evidence.image.caption}
            </figcaption>
          </figure>
        )}
      </div>

      </Disclosure>

      <p className="border-t border-canopy/10 pt-4 text-sm text-stone">
        Data: {project.provenance.source}, as at {asAt(project.provenance.updated)}. {project.provenance.note} {project.excludedNote}
        {project.bedroomsInferred ? " Bedroom counts are inferred from unit size, not recorded." : ""}
        Figures are historical and not a guarantee of future performance.
      </p>
    </div>
  );
}
