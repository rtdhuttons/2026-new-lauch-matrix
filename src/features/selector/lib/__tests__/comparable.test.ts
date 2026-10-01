import { describe, expect, it } from "vitest";
import { jadescape } from "../../data/comparables/jadescape";
import { thomsonReserveDataset as ds, thomsonReserveMrtExit } from "../../data/thomson-reserve";
import { bandStats, floorBandPoints, likeForLike, profitTrend } from "../comparable";
import { createEngine } from "../engine";

describe("JadeScape floor-band evidence", () => {
  const stats = bandStats(jadescape.transactions);

  it("matches the Huttons report: 321 resales across three bands", () => {
    expect(jadescape.transactions).toHaveLength(321);
    expect(stats.map((b) => b.homes)).toEqual([143, 139, 39]);
    expect(stats.map((b) => Math.round(b.avgProfit))).toEqual([443_849, 441_445, 510_377]);
    expect(stats.map((b) => b.medianProfit)).toEqual([368_000, 362_800, 387_200]);
    expect(stats.map((b) => Math.round(b.psfGain))).toEqual([467, 477, 528]);
    expect(stats.map((b) => (b.annualised * 100).toFixed(2))).toEqual(["5.33", "5.44", "5.65"]);
    expect(stats[2].floors).toBe("#21–#23");
  });

  it("shows the same pattern like for like", () => {
    const four = likeForLike(jadescape.transactions, 4)!;
    expect(four.high.avgProfit).toBeGreaterThan(four.low.avgProfit);
    expect(profitTrend(jadescape.transactions).slope).toBeGreaterThan(0);
  });

  it("adds exit-appeal points by floor band: 0 low, 30 high", () => {
    expect(floorBandPoints(jadescape, 5)?.points).toBe(0);
    expect(floorBandPoints(jadescape, 15)?.points).toBe(10);
    expect(floorBandPoints(jadescape, 28)?.points).toBe(30);
    const engine = createEngine(ds, thomsonReserveMrtExit);
    const unit = (level: number) => ds.units.find((u) => u.stackId === "20" && u.level === level)!;
    const low = engine.assess(unit(5)).resale;
    const high = engine.assess(unit(25)).resale;
    expect(high.floorEvidence?.points).toBe(30);
    expect(high.score! - low.score!).toBe(30);
  });
});
