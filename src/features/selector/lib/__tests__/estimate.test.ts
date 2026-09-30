import { describe, expect, it } from "vitest";
import { demoDataset as demo } from "../../data/demo";
import { thomsonReserveDataset as ds, thomsonReserveMrtExit } from "../../data/thomson-reserve";
import { createEngine } from "../engine";
import { applyPriceEstimate, DEFAULT_ESTIMATE, estimatedPsf } from "../estimate";
import { psf } from "../pricing";
import { DEFAULT_PREFERENCES, rankUnits, recommend } from "../recommend";

describe("illustrative price estimate", () => {
  const priced = applyPriceEstimate(ds, DEFAULT_ESTIMATE);
  const engine = createEngine(priced, thomsonReserveMrtExit);

  it("starts at $2,850 psf on the lowest level and adds $15 psf a floor", () => {
    expect(estimatedPsf(1, DEFAULT_ESTIMATE, 1)).toBe(2850);
    expect(estimatedPsf(25, DEFAULT_ESTIMATE, 1)).toBe(2850 + 15 * 24);
    // Block 5 #25-19, Type E1 (L), 1,808 sq ft.
    const u = priced.units.find((x) => x.id === "19-25")!;
    expect(u.price).toBe(Math.round((1808 * 3210) / 1000) * 1000);
    expect(psf(engine.ix, u)).toBeCloseTo(3210, -1);
  });

  it("flags every price as an assumption and keeps availability unknown", () => {
    expect(priced.units.every((u) => u.price !== null && u.priceIsEstimate && u.status === "pending")).toBe(true);
    expect(priced.units.every((u) => u.priceProvenance.status === "assumed")).toBe(true);
    expect(ds.units.every((u) => u.price === null)).toBe(true);
  });

  it("follows the user's settings", () => {
    const flat = applyPriceEstimate(ds, { basePsf: 3000, stepPsf: 0 });
    const a = flat.units.find((x) => x.id === "19-25")!;
    const b = flat.units.find((x) => x.id === "19-10")!;
    expect(a.price).toBe(b.price);
    expect(a.price).toBe(Math.round((1808 * 3000) / 1000) * 1000);
  });

  it("lets recommendations run on the estimate", () => {
    const recs = recommend(rankUnits(engine, DEFAULT_PREFERENCES));
    expect(recs.some((r) => r.unit !== null)).toBe(true);
  });

  it("never overrides real prices", () => {
    expect(applyPriceEstimate(demo, DEFAULT_ESTIMATE)).toBe(demo);
  });
});
