import { describe, expect, it } from "vitest";
import { catalogue, market } from "../data";
import { fromPrice, km, projectCagr, projectStatus, psfTrendCagr, recommendNearby, within } from "../lib";
import type { CatalogueProject } from "../model";

const tr = catalogue.projects.find((p) => p.name === "Thomson Reserve")!;

describe("distances", () => {
  it("measures great-circle distance", () => {
    // Thomson Reserve to JadeScape, about 0.9 km apart.
    const d = km({ lat: 1.356314, lon: 103.831239 }, { lat: 1.351815, lon: 103.838298 });
    expect(d).toBeGreaterThan(0.85);
    expect(d).toBeLessThan(0.98);
    expect(km({ lat: 1.3, lon: 103.8 }, { lat: 1.3, lon: 103.8 })).toBe(0);
  });

  it("lists what is within a radius, nearest first", () => {
    const near = within(tr as CatalogueProject & { lat: number; lon: number }, market.projects, 2);
    expect(near[0].item.name).toBe("JadeScape");
    expect(near.every((n, i) => i === 0 || n.km >= near[i - 1].km)).toBe(true);
  });
});

describe("recommendations", () => {
  it("suggests nearby projects with units left and a shared bedroom type", () => {
    const recs = recommendNearby(tr, catalogue.projects, "2026-10-05", 5);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.map((r) => r.item.name)).not.toContain("Thomson Reserve");
    for (const r of recs) {
      expect(r.km).toBeLessThanOrEqual(5);
      expect(r.sharedBedrooms.length).toBeGreaterThan(0);
      expect(r.reason).toMatch(/away/);
    }
    // Lentoria (about 2.9 km) is nearer than Springleaf Residence (about 4.8 km).
    const names = recs.map((r) => r.item.name);
    expect(names.indexOf("Lentoria")).toBeLessThan(names.indexOf("Springleaf Residence"));
  });

  it("knows a project launching later is upcoming", () => {
    expect(projectStatus(tr, "2026-10-05")).toBe("upcoming");
    expect(projectStatus(tr, "2026-11-01")).toBe("selling");
  });

  it("finds the lowest price still available", () => {
    const lentoria = catalogue.projects.find((p) => p.name === "Lentoria")!;
    expect(fromPrice(lentoria)).toBe(Math.min(...lentoria.unitTypes.filter((t) => t.fromPrice !== null).map((t) => t.fromPrice!)));
    expect(fromPrice(tr)).toBeNull();
  });
});

describe("CAGR", () => {
  it("grows the median price per sq ft between the first and latest busy years", () => {
    const c = psfTrendCagr([
      { year: 2020, count: 10, medianPsf: 1500, newSale: 10, subSale: 0, resale: 0 },
      { year: 2021, count: 1, medianPsf: 9999, newSale: 0, subSale: 0, resale: 1 },
      { year: 2025, count: 8, medianPsf: 2000, newSale: 0, subSale: 0, resale: 8 },
    ])!;
    expect(c.fromYear).toBe(2020);
    expect(c.toYear).toBe(2025);
    expect(c.rate).toBeCloseTo((2000 / 1500) ** (1 / 5) - 1, 10);
    expect(psfTrendCagr([{ year: 2025, count: 9, medianPsf: 2000, newSale: 0, subSale: 0, resale: 9 }])).toBeNull();
  });

  it("uses JadeScape's matched resales: 5.42% a year across 321 owners", () => {
    const j = market.projects.find((p) => p.name === "JadeScape")!;
    const c = projectCagr(j)!;
    expect(c.basis).toBe("matched-resales");
    expect(c.rate).toBeCloseTo(0.0542, 4);
    expect(j.rentals.some((r) => r.bedrooms === 3 && r.count > 0)).toBe(true);
  });
});
