import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildAutoBundle, type AutoSpec, type AutoTrace } from "../../data/auto/build";
import { autoListings } from "../../data/auto/registry";
import { projects } from "../../data/projects";
import { indexDataset } from "../dataset-index";
import { applyPriceEstimate } from "../estimate";
import { checkProject } from "../project-check";

const dir = join(__dirname, "../../data/auto");
const specs = readdirSync(join(dir, "specs"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(dir, "specs", f), "utf8")) as AutoSpec);
const traceOf = (id: string): AutoTrace | null => {
  const f = join(dir, "traces", `${id}.json`);
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as AutoTrace) : null;
};

describe("automatic mini sites", () => {
  it("registers every project once, after the hand-built ones", () => {
    expect(autoListings.length).toBe(specs.length);
    expect(new Set(projects.map((p) => p.id)).size).toBe(projects.length);
    expect(projects.filter((p) => p.featured).map((p) => p.id)).toEqual(["thomson-reserve", "the-serra-residences"]);
  });

  it.each(specs.map((s) => [s.name, s] as const))("%s builds a bundle that passes the project check", (_, spec) => {
    const bundle = buildAutoBundle(spec, traceOf(spec.id));
    const check = checkProject(bundle);
    expect(check.errors).toEqual([]);
    const ds = bundle.dataset;
    // Every unit in the API's list becomes one unit on the site, with its own size.
    const keys = new Set(spec.units.map((u) => `${u[0]}|${u[1]}|${u[2]}`));
    expect(ds.units.length).toBe(keys.size);
    const ix = indexDataset(ds);
    // Sizes come from the API, or stay unknown when it has none.
    for (const u of ds.units) expect(ix.unitLayout(u).areaSqft === null || ix.unitLayout(u).areaSqft! > 0).toBe(true);
    // Untraced layouts never claim a facing.
    if (!traceOf(spec.id)) expect(ds.stacks.every((s) => s.facingKnown === false)).toBe(true);
    // Estimates only stand in when nothing is priced.
    if (bundle.pricing.estimate) {
      expect(ds.units.every((u) => u.price === null)).toBe(true);
      const priced = applyPriceEstimate(ds, bundle.pricing.estimate);
      expect(priced.units.some((u) => u.priceIsEstimate)).toBe(true);
    }
  });
});
