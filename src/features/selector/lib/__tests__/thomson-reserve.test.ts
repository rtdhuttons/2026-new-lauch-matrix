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

  it("places all 1,268 homes, 528 of them in the Luxury Collection", () => {
    expect(ds.units).toHaveLength(1268);
    const luxury = ds.units.filter((u) => {
      const s = ds.stacks.find((x) => x.id === u.stackId)!;
      return ds.blocks.find((b) => b.id === s.blockId)!.collection === "Luxury";
    });
    expect(luxury).toHaveLength(528);
  });

  it("matches the factsheet unit mix type by type", () => {
    const bySize = new Map<number, number>();
    for (const u of ds.units) {
      const s = ds.stacks.find((x) => x.id === u.stackId)!;
      const area = ds.layouts.find((l) => l.id === s.layoutId)!.areaSqft!;
      bySize.set(area, (bySize.get(area) ?? 0) + 1);
    }
    expect(Object.fromEntries(bySize)).toEqual({
      592: 100, 678: 416, 732: 120, 775: 80, 947: 120, 1055: 170,
      1152: 60, 1238: 90, 1367: 56, 1485: 28, 1808: 28,
    });
  });

  it("starts some Luxury stacks at level 1 and others at level 3", () => {
    const first = (id: string) => Math.min(...ds.units.filter((u) => u.stackId === id).map((u) => u.level));
    expect(first("20")).toBe(1);
    expect(first("19")).toBe(3);
    expect(first("01")).toBe(2);
    expect(ds.units.find((u) => u.id === "01-02")!.typeCode).toBe("CP2p");
  });

  it("publishes no prices until the developer does", () => {
    expect(ds.units.every((u) => u.price === null && u.status === "pending")).toBe(true);
  });

  it("keeps view clearance unassessed while neighbour heights are missing", () => {
    const engine = createEngine(ds, thomsonReserveMrtExit);
    const a = engine.assess(ds.units[0]);
    expect(a.level?.category).toBe("unknown");
    expect(a.scores.view.score).toBeNull();
    expect(a.scores.resale.score).not.toBeNull();
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
