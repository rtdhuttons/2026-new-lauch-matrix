import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { thomsonReserveDataset as ds, thomsonReserveMrtExit } from "../../data/thomson-reserve";
import { levelView } from "../clearance";
import { createEngine } from "../engine";
import { screenExposure } from "../exposure";
import { floorRL } from "../geometry";
import { facingNote } from "../format";
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

  it("scores the view of a north-east-facing home below level 21 as blocked", () => {
    const engine = createEngine(ds, thomsonReserveMrtExit);
    // Stack 01 faces east-south-east, on the HDB side: its lowest home is below the HDB blocks.
    const a = engine.assess(ds.units.find((u) => u.stackId === "01")!);
    expect(a.level?.category).toBe("below");
    expect(a.scores.view.score).not.toBeNull();
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

  it("labels view directions from the brief", () => {
    const labels = new Set(ds.stacks.map((s) => s.mainView.label));
    expect([...labels].some((l) => l.startsWith("Towards MacRitchie"))).toBe(true);
    expect([...labels].some((l) => l.startsWith("Across the development"))).toBe(true);
  });

  it("assesses views over the landed estates from the brief's storey counts", () => {
    const engine = createEngine(ds, thomsonReserveMrtExit);
    // Stack 28 (Block 7) faces west over the landed homes towards Windsor Nature Park.
    const v = engine.view("28");
    expect(v.target?.id).toBe("catchment-forest");
    // Looking across the development at a block of the same height never clears it.
    const across = engine.view("06");
    expect(across.governing?.obstruction.kind).toBe("own-block");
    expect(across.clearFrom.conservative).toBeNull();
    // Non-GCBA landed estates have unverified zoning, so future risk stays unknown.
    expect(v.futureRisk.level).toBe("unknown");
  });

  it("gives every home the developer's floor plan for its type", () => {
    for (const u of ds.units) {
      expect(u.floorPlan, u.id).toBeDefined();
      expect(existsSync(`public${u.floorPlan!.src}`), u.floorPlan!.src).toBe(true);
    }
    // The level 2 PES home in stack 01 shares Type CP2's page.
    const pes = ds.units.find((u) => u.id === "01-02")!;
    const typical = ds.units.find((u) => u.id === "01-10")!;
    expect(pes.typeCode).toBe("CP2p");
    expect(pes.floorPlan!.src).toBe(typical.floorPlan!.src);
    expect(ds.units.find((u) => u.id === "17-10")!.floorPlan!.mirrored).toBe(true);
  });

  it("describes facings in plain words", () => {
    expect(facingNote(169)).toMatch(/^North\/south-facing/);
    expect(facingNote(90)).toMatch(/^East-facing/);
    expect(facingNote(260)).toMatch(/^West-facing/);
  });

  it("uses the agent's on-site assessment: south-west from level 5, north-east from level 21", () => {
    const engine = createEngine(ds, thomsonReserveMrtExit);
    const sw = engine.view("28"); // Block 7, faces west over the landed homes
    expect(sw.observed?.fromLevel).toBe(5);
    expect(sw.clearFrom).toEqual({ optimistic: 5, conservative: 5 });
    expect(sw.status).toBe("estimated");
    expect(levelView(sw, 4)?.category).toBe("below");
    expect(levelView(sw, 5)?.category).toBe("clear");
    expect(levelView(sw, 8)?.category).toBe("clear-limited");

    const ne = engine.view("32"); // Block 7, faces north-east towards the HDB blocks
    expect(ne.observed?.fromLevel).toBe(21);
    expect(ne.stack.mainView.label).toMatch(/HDB/);
    expect(levelView(ne, 20)?.category).toBe("below");
    expect(levelView(ne, 21)?.category).toBe("clear");

    // Every outward stack belongs to one side: stack 01 faces east-south-east, on the HDB side.
    expect(engine.view("01").observed?.fromLevel).toBe(21);
    expect(engine.view("11").observed?.fromLevel).toBe(5); // faces south-south-east, landed side
    // A stack looking straight at another Thomson Reserve block keeps the geometric result.
    expect(engine.view("06").observed).toBeUndefined();
  });
});

describe("Thomson Reserve neighbourhood map", () => {
  const map = ds.project.display!.mapContext!;

  it("places OpenStreetMap's Upper Thomson Exit 2 on the site plan's MRT marker", () => {
    // Exit 2 (OSM node, lat 1.3555954, lon 103.8317171) through the same fit as scripts/osm/build-context.py.
    const e = (103.8317171 - 103.83) * 111320 * Math.cos((1.3566 * Math.PI) / 180);
    const n = (1.3555954 - 1.3566) * 110574;
    const p = (40 * Math.PI) / 180;
    const x = e * Math.cos(p) - n * Math.sin(p) + 787.5 / 2.66;
    const y = -(n * Math.cos(p) + e * Math.sin(p)) + 570 / 2.66;
    expect(Math.hypot(x - thomsonReserveMrtExit.x, y - thomsonReserveMrtExit.y)).toBeLessThan(3);
  });

  it("draws the neighbourhood and credits OpenStreetMap", () => {
    expect(map.buildings.length).toBeGreaterThan(500);
    expect(map.roads.length).toBeGreaterThan(100);
    expect(map.credit).toContain("OpenStreetMap");
    // Nothing from the map sits on the site's own towers.
    const centre = (pts: { x: number; y: number }[]) => ({ x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length });
    const onSite = map.buildings.filter((b) => ds.blocks.some((k) => Math.hypot(centre(b.footprint).x - k.centre.x, centre(b.footprint).y - k.centre.y) < 25));
    expect(onSite).toHaveLength(0);
  });

  it("uses only buildings with a recorded storey count as obstructions", () => {
    const mapped = ds.obstructions.filter((o) => o.fromMap);
    expect(mapped.some((o) => o.name.startsWith("21-storey block, 45 Bright Hill Drive"))).toBe(true);
    for (const o of mapped) {
      expect(o.kind).toBe("existing-building");
      expect(["OpenStreetMap", "HDB Property Information (data.gov.sg)"]).toContain(o.heightProvenance.source);
      expect(Number(o.name.split("-")[0])).toBeGreaterThanOrEqual(4);
    }
    // HDB blocks the map has without storeys take HDB's own highest floor.
    expect(mapped.some((o) => o.name === "25-storey block, Blk 444 Sin Ming Avenue" && o.heightProvenance.source.startsWith("HDB"))).toBe(true);
    // The 3D model draws them with the map layer, not twice.
    expect(buildScene(ds).buildings.some((b) => b.id.startsWith("osm-"))).toBe(false);
  });
});
