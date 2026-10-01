import { describe, expect, it } from "vitest";
import { demoDataset as dataset } from "../../data/demo";
import { mrtEntrance } from "../../data/demo/access";
import type { Block, Dataset, Obstruction, Stack, Unit, ViewTarget } from "../../model/types";
import { analyseStackView, levelView, requiredEyeForEdge } from "../clearance";
import { indexDataset } from "../dataset-index";
import { createEngine } from "../engine";
import { bearingVector, floorRL, rayPolygonSpan } from "../geometry";
import { clearanceCost, premiumOver } from "../pricing";
import {
  DEFAULT_PREFERENCES,
  lifestyleFit,
  rankUnits,
  recommend,
} from "../recommend";
import { sunPosition } from "../solar";

const prov = { source: "test", updated: "2026-09-30", status: "estimated" as const };

function syntheticDataset(opts: { groundRL: number; obstructionTop: { min: number; max: number } }): Dataset {
  const block: Block = {
    id: "B",
    name: "Block T",
    centre: { x: 0, y: 0 },
    size: { w: 20, h: 20 },
    rotationDeg: 0,
    storeys: 30,
    groundRL: opts.groundRL,
    level1HeightM: 4.5,
    typicalFloorHeightM: 3,
    roofAllowanceM: 3,
    noUnitLevels: [],
    firstResidentialLevel: 2,
    provenance: prov,
  };
  const stack: Stack = {
    id: "S",
    blockId: "B",
    layoutId: "L",
    position: { x: 0, y: -10 },
    livingBearingDeg: 0,
    masterBearingDeg: 90,
    mainView: { label: "Lake", bearingDeg: 0, coneHalfWidthDeg: 5, targetId: "lake", provenance: prov },
    provenance: prov,
  };
  const wall: Obstruction = {
    id: "wall",
    name: "Neighbouring tower",
    kind: "existing-building",
    footprint: [
      { x: -200, y: -110 },
      { x: 200, y: -110 },
      { x: 200, y: -90 },
      { x: -200, y: -90 },
    ],
    baseRL: 20,
    topRL: opts.obstructionTop,
    heightProvenance: prov,
  };
  const lake: ViewTarget = {
    id: "lake",
    name: "Lake",
    footprint: [
      { x: -500, y: -1000 },
      { x: 500, y: -1000 },
      { x: 500, y: -410 },
      { x: -500, y: -410 },
    ],
    surfaceRL: 20,
    provenance: prov,
  };
  return {
    ...dataset,
    blocks: [block],
    stacks: [stack],
    layouts: [{ ...dataset.layouts[0], id: "L" }],
    units: [],
    obstructions: [wall],
    viewTargets: [lake],
    futureSites: [],
  };
}

describe("geometry", () => {
  it("maps bearings to plan directions with y pointing south", () => {
    const n = bearingVector(0);
    expect(n.x).toBeCloseTo(0);
    expect(n.y).toBeCloseTo(-1);
    const e = bearingVector(90);
    expect(e.x).toBeCloseTo(1);
  });

  it("finds where a ray enters and leaves a polygon", () => {
    const square = [
      { x: -5, y: -20 },
      { x: 5, y: -20 },
      { x: 5, y: -10 },
      { x: -5, y: -10 },
    ];
    const span = rayPolygonSpan({ x: 0, y: 0 }, bearingVector(0), square)!;
    expect(span.near).toBeCloseTo(10);
    expect(span.far).toBeCloseTo(20);
    expect(rayPolygonSpan({ x: 0, y: 0 }, bearingVector(180), square)).toBeNull();
  });

  it("builds floor levels from ground level and storey heights", () => {
    const b = dataset.blocks[0];
    expect(floorRL(b, 2)).toBeCloseTo(b.groundRL + b.level1HeightM);
    expect(floorRL(b, 3) - floorRL(b, 2)).toBeCloseTo(b.typicalFloorHeightM);
  });
});

describe("view clearance", () => {
  it("solves the eye level that grazes an obstruction edge", () => {
    // Obstruction top 50 m at 100 m, target at level 20 and 400 m.
    const eye = requiredEyeForEdge(100, 400, 20, 50);
    const lineAtObstruction = eye + ((20 - eye) * 100) / 400;
    expect(lineAtObstruction).toBeCloseTo(50);
  });

  it("gives a floor range when the obstruction height is uncertain", () => {
    const ds = syntheticDataset({ groundRL: 20, obstructionTop: { min: 50, max: 58 } });
    const v = analyseStackView(indexDataset(ds), "S");
    expect(v.clearFrom.optimistic).not.toBeNull();
    expect(v.clearFrom.conservative!).toBeGreaterThan(v.clearFrom.optimistic!);
    const inRange = levelView(v, v.clearFrom.optimistic!)!;
    expect(inRange.uncertain).toBe(true);
    expect(levelView(v, v.clearFrom.optimistic! - 1)!.category).toBe("below");
    expect(levelView(v, v.clearFrom.conservative!)!.category).toBe("clear");
    expect(levelView(v, v.clearFrom.conservative! + 3)!.category).toBe("clear-limited");
  });

  it("depends on ground level, not the floor number alone", () => {
    const low = analyseStackView(
      indexDataset(syntheticDataset({ groundRL: 20, obstructionTop: { min: 60, max: 60 } })),
      "S",
    );
    const high = analyseStackView(
      indexDataset(syntheticDataset({ groundRL: 35, obstructionTop: { min: 60, max: 60 } })),
      "S",
    );
    expect(high.clearFrom.conservative!).toBeLessThan(low.clearFrom.conservative!);
  });

  it("reports a stack as not clearing when its block is too low", () => {
    const v = analyseStackView(
      indexDataset(syntheticDataset({ groundRL: 20, obstructionTop: { min: 400, max: 400 } })),
      "S",
    );
    expect(v.clearFrom.optimistic).toBeNull();
    expect(v.levels.every((l) => l.category === "below")).toBe(true);
  });
});

describe("sun position", () => {
  const sg = { lat: 1.354, lon: 103.83, tz: 8 };
  it("puts the afternoon sun in the north-west in June and south-west in December", () => {
    const june = sunPosition(5, 16 * 60, sg.lat, sg.lon, sg.tz);
    const dec = sunPosition(11, 16 * 60, sg.lat, sg.lon, sg.tz);
    expect(june.azimuthDeg).toBeGreaterThan(270);
    expect(dec.azimuthDeg).toBeGreaterThan(180);
    expect(dec.azimuthDeg).toBeLessThan(270);
  });
  it("is high around 1pm and below the horizon at 8pm", () => {
    expect(sunPosition(2, 13 * 60 + 10, sg.lat, sg.lon, sg.tz).altitudeDeg).toBeGreaterThan(80);
    expect(sunPosition(2, 20 * 60, sg.lat, sg.lon, sg.tz).altitudeDeg).toBeLessThan(0);
  });
});

describe("pricing", () => {
  const engine = createEngine(dataset, mrtEntrance);
  const ix = engine.ix;
  const avail = (stackId: string) =>
    ix.unitsInStack(stackId).filter((u) => u.status === "available");

  it("never publishes a price for units that are not on sale", () => {
    for (const u of dataset.units) {
      if (u.status !== "available") expect(u.price).toBeNull();
      else expect(u.price).toBeGreaterThan(0);
    }
  });

  it("only gives a per-floor premium within the same stack", () => {
    const [a, b] = avail("01");
    const same = premiumOver(ix, b, a)!;
    expect(same.perFloor).toBeCloseTo((b.price! - a.price!) / (b.level - a.level));
    expect(same.likeForLike.sameLayout).toBe(true);
    const other = premiumOver(ix, avail("02")[0], a)!;
    expect(other.perFloor).toBeNull();
    expect(other.likeForLike.differences.length).toBeGreaterThan(0);
  });

  it("measures the cost of reaching view clearance from available units only", () => {
    const view = engine.view("01");
    const top = ix.unit("01-20")!;
    const cost = clearanceCost(ix, view, top);
    expect(cost.firstClear!.status).toBe("available");
    expect(cost.below!.status).toBe("available");
    expect(cost.below!.level).toBeLessThan(view.clearFrom.optimistic!);
    expect(cost.firstClear!.level).toBeGreaterThanOrEqual(view.clearFrom.conservative!);
    expect(cost.extraAboveClear).toBe(top.price! - cost.firstClear!.price!);
  });
});

describe("recommendations", () => {
  const engine = createEngine(dataset, mrtEntrance);

  it("applies essentials before ranking", () => {
    const prefs = { ...DEFAULT_PREFERENCES, budget: 1_600_000, bedrooms: 2 as const };
    const ranked = rankUnits(engine, prefs);
    for (const r of ranked.filter((x) => x.eligible)) {
      expect(r.assessment.unit.price!).toBeLessThanOrEqual(1_600_000);
      expect(engine.ix.stackLayout(r.assessment.unit.stackId).bedrooms).toBe(2);
    }
    const recs = recommend(ranked);
    expect(recs.map((r) => r.kind)).toEqual(["best-fit", "lowest-entry", "best-value"]);
  });

  it("keeps unknown values out of the fit score instead of averaging them", () => {
    const unit = dataset.units.find((u) => u.status === "available")!;
    const a = engine.assess(unit);
    const withUnknown = { ...a, scores: { ...a.scores, view: { score: null, status: "unknown" as const } } };
    const fit = lifestyleFit(withUnknown, { sun: 1, quiet: 1, view: 2, mrt: 0, resale: 0 });
    expect(fit.unknown).toEqual(["view"]);
    expect(fit.coverage).toBeCloseTo(0.5);
    expect(fit.score).toBeCloseTo((a.scores.sun.score! + a.scores.quiet.score!) / 2);
  });

  it("explains when nothing meets the essentials", () => {
    const recs = recommend(rankUnits(engine, { ...DEFAULT_PREFERENCES, budget: 100_000 }));
    expect(recs.every((r) => r.unit === null)).toBe(true);
  });
});

describe("demo data integrity", () => {
  it("labels itself as illustrative", () => {
    expect(dataset.project.isDemo).toBe(true);
  });

  it("has a unit for every residential level of every stack except no-unit levels", () => {
    const ix = indexDataset(dataset);
    for (const s of dataset.stacks) {
      const b = ix.block(s.blockId);
      const units: Unit[] = ix.unitsInStack(s.id);
      const expected = b.storeys - b.firstResidentialLevel + 1 - b.noUnitLevels.length;
      expect(units).toHaveLength(expected);
      for (const l of b.noUnitLevels) expect(units.find((u) => u.level === l)).toBeUndefined();
    }
  });
});
