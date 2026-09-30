import { describe, expect, it } from "vitest";
import { thomsonReserveDataset as ds, thomsonReserveMrtExit } from "../../data/thomson-reserve";
import { createEngine } from "../engine";
import { rankUnits, recommend, DEFAULT_PREFERENCES } from "../recommend";
import { buildScene } from "../scene";

describe("Thomson Reserve dataset", () => {
  it("has the six blocks and 55 stacks on the developer's site plan", () => {
    expect(ds.blocks.map((b) => b.id)).toEqual(["1", "3", "5", "7", "9", "11"]);
    expect(ds.stacks).toHaveLength(55);
    const ids = ds.stacks.map((s) => Number(s.id)).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 55 }, (_, i) => i + 1));
  });

  it("matches the reported Classic Collection total of 740 homes", () => {
    const classic = ds.units.filter((u) => {
      const s = ds.stacks.find((x) => x.id === u.stackId)!;
      return ds.blocks.find((b) => b.id === s.blockId)!.collection === "Classic";
    });
    expect(classic).toHaveLength(740);
  });

  it("uses 21-storey Classic and 30-storey Luxury blocks", () => {
    for (const b of ds.blocks) expect(b.storeys).toBe(b.collection === "Luxury" ? 30 : 21);
  });

  it("publishes no prices and no unit types until the developer does", () => {
    expect(ds.units.every((u) => u.price === null && u.status === "pending")).toBe(true);
    expect(ds.layouts.every((l) => l.bedrooms === null && l.areaSqft === null)).toBe(true);
  });

  it("keeps view clearance unassessed while neighbour heights are missing", () => {
    const engine = createEngine(ds, thomsonReserveMrtExit);
    const a = engine.assess(ds.units[0]);
    expect(a.level?.category).toBe("unknown");
    expect(a.scores.view.score).toBeNull();
    expect(a.scores.resale.score).toBeNull();
    expect(a.mrt.best).not.toBeNull();
  });

  it("recommends nothing until prices exist", () => {
    const engine = createEngine(ds, thomsonReserveMrtExit);
    const recs = recommend(rankUnits(engine, DEFAULT_PREFERENCES));
    expect(recs.every((r) => r.unit === null)).toBe(true);
  });

  it("builds one 3D box per home, placed on its traced stack", () => {
    const scene = buildScene(ds);
    expect(scene.units).toHaveLength(ds.units.length);
    for (const s of ds.stacks) {
      const box = scene.units.find((b) => b.unit.stackId === s.id)!;
      expect(Math.hypot(box.x - s.position.x, box.z - s.position.y)).toBeLessThan(0.01);
    }
  });
});
