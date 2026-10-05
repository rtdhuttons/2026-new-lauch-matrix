"use client";

// Price by floor for the selected stack, with the selected floor marked.

import type { Engine } from "../lib/engine";
import { ChartCard, fmtMoney, fmtMoneyShort, LineChart, SERIES } from "./charts";

export function StackPriceChart({ engine, stackId, level, typeName, priceNote }: { engine: Engine; stackId: string; level: number; typeName: string; priceNote: string | null }) {
  const ix = engine.ix;
  // Only the selected floor's unit type, where a stack's type changes higher up.
  const all = ix.unitsInStack(stackId);
  const here = all.find((u) => u.level === level);
  const layout = here ? ix.unitLayout(here) : ix.stackLayout(stackId);
  const area = layout.areaSqft;
  const units = all
    .filter((u) => u.price !== null && ix.unitLayout(u).id === layout.id)
    .sort((a, b) => a.level - b.level);
  if (units.length < 2) return null;
  const first = units[0];
  const last = units[units.length - 1];
  const selected = units.find((u) => u.level === level);
  const perFloor = (last.price! - first.price!) / (last.level - first.level);
  const isEstimate = units.some((u) => u.priceIsEstimate);

  return (
    <ChartCard
      className="mt-6"
      title={`Price by floor: stack ${stackId}`}
      subtitle={
        <>
          {typeName}: from {fmtMoney(first.price!)} on level {first.level} to {fmtMoney(last.price!)} on level {last.level}, about {fmtMoney(perFloor)} more for each floor
          {selected ? `. Level ${level} is marked.` : "."}
        </>
      }
      note={isEstimate ? (priceNote ?? "Estimated prices, not the developer's price list.") : undefined}
      table={{
        caption: `Price and price per sq ft by floor, stack ${stackId}`,
        columns: ["Level", "Price", "Per sq ft"],
        rows: units.map((u) => [u.level, fmtMoney(u.price!), area ? `S$${Math.round(u.price! / area).toLocaleString("en-SG")}` : "—"]),
      }}
    >
      <LineChart
        ariaLabel={`Price by floor for stack ${stackId}`}
        height={220}
        xFormat={(x) => `Level ${x}`}
        yFormat={fmtMoneyShort}
        highlightX={selected ? level : undefined}
        xTicks={[...new Set([first.level, ...units.filter((u) => u.level % 5 === 0).map((u) => u.level), last.level])]}
        series={[{ id: "price", label: isEstimate ? "estimated price" : "price", color: SERIES[0], points: units.map((u) => ({ x: u.level, y: u.price! })) }]}
      />
    </ChartCard>
  );
}
