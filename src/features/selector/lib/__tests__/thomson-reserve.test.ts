import { describe, expect, it } from "vitest";
import { thomsonReserveDataset as ds, thomsonReserveMrtExit } from "../../data/thomson-reserve";
import { createEngine } from "../engine";
import { screenExposure } from "../exposure";
import { floorRL } from "../geometry";
import { indexDataset } from "../dataset-index";
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

  it("matches the architect's block-to-block dimensions within 8%", () => {
    // Gap between the homes at each end, from the brief's distance plan.
    const brief: [string, string, number][] = [
      ["33", "37", 190], ["35", "45", 182], ["35", "15", 240], ["27", "14", 171],
      ["51", "09", 40], ["55", "15", 77], ["54", "16", 80], ["51", "18", 63],
    ];
    for (const [a, b, metres] of brief) {
      const A = ds.stacks.find((s) => s.id === a)!;
      const B = ds.stacks.find((s) => s.id === b)!;
      const gap =
        Math.hypot(A.position.x - B.position.x, A.position.y - B.position.y) -
        (A.footprint!.w + B.footprint!.w) / 2;
      expect(Math.abs(gap / metres - 1), `${a}–${b}`).toBeLessThan(0.08);
    }
  });

  it("puts the first homes at the brief's heights above Upper Thomson Road", () => {
    expect(ds.project.heightDatum).toBe("Upper Thomson Road");
    for (const b of ds.blocks) {
      expect(floorRL(b, b.firstResidentialLevel)).toBeCloseTo(b.collection === "Luxury" ? 8.5 : 14.5, 5);
    }
  });

  it("reports the covered linkway from Side Gate 1 to the MRT", () => {
    const engine = createEngine(ds, thomsonReserveMrtExit);
    const unit = ds.units.find((u) => u.stackId === "05" && u.level === 10)!;
    const best = engine.assess(unit).mrt.best!;
    expect(best.gate.name).toMatch(/Side Gate 1/);
    expect(best.external.distanceM).toBe(65);
    expect(best.external.coveredM).toBe(65);
  });

  it("gives road findings a height above the road", () => {
    const ix = indexDataset(ds);
    const unit = ds.units.find((u) => u.stackId === "19" && u.level === 10)!;
    const road = screenExposure(ix, unit).noise.find((n) => n.source.id === "upper-thomson")!;
    const block = ix.stackBlock("19");
    expect(road.heightAboveM).toBe(Math.round(floorRL(block, 10) + 1.5));
    expect(road.source.context).toMatch(/forest band/);
  });

  it("labels view directions without implying clearance", () => {
    const labels = new Set(ds.stacks.map((s) => s.mainView.label));
    expect([...labels].some((l) => l.startsWith("Towards MacRitchie"))).toBe(true);
    expect([...labels].some((l) => l.startsWith("Across the development"))).toBe(true);
    for (const s of ds.stacks) expect(s.mainView.targetId).toBe("");
  });
});
