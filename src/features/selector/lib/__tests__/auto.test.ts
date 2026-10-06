import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildAutoBundle, type AutoSpec, type AutoTrace } from "../../data/auto/build";
import { autoListings } from "../../data/auto/registry";
import { projects } from "../../data/projects";
import { indexDataset } from "../dataset-index";
import { applyPriceEstimate } from "../estimate";
import { checkProject } from "../project-check";
import { chosenComparables } from "../../data/comparables/chosen";
import { chosenNotes } from "../../data/comparables/chosen-notes";
import { stillBuilding } from "../../data/comparables/choice";
import { uraComparables } from "../../data/comparables/ura-comparables";
import { changeSinceLaunch, grossYield } from "../../components/comparable-records";

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

  it("shows projects without released units as coming soon, not an empty selector", () => {
    const empty = specs.filter((s) => s.units.length === 0);
    for (const s of empty) {
      const b = buildAutoBundle(s, null);
      expect(b.dataset.units).toEqual([]);
      expect(b.profile.towersSummary).toBeNull();
    }
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

describe("TRM's chosen comparables", () => {
  it("gives every chosen project a mini site card and a written reason", () => {
    for (const p of chosenComparables.projects) {
      expect(chosenNotes[p.slug], p.slug).toBeTruthy();
      if (p.slug === "thomson-reserve") continue;
      const spec = specs.find((s) => s.id === p.slug);
      expect(spec, p.slug).toBeTruthy();
      expect(buildAutoBundle(spec!, traceOf(spec!.id)).comparableChoice?.comparables.map((c) => c.name)).toEqual(p.comparables.map((c) => c.name));
    }
    // Only chosen projects get a card.
    const unchosen = specs.find((s) => !chosenComparables.projects.some((p) => p.slug === s.id))!;
    expect(buildAutoBundle(unchosen, null).comparableChoice).toBeNull();
  });

  it("quotes distances in the reasons that match OneMap's", () => {
    for (const p of chosenComparables.projects) {
      const quoted = [...chosenNotes[p.slug].matchAll(/about ([\d.,]+) (m|km)/g)].map((m) => (m[2] === "m" ? Number(m[1].replace(",", "")) / 1000 : Number(m[1])));
      const actual = p.comparables.map((c) => c.km!);
      for (const q of quoted) expect(actual.some((a) => Math.abs(a - q) <= Math.max(0.05, a * 0.1)), `${p.slug}: about ${q} km`).toBe(true);
    }
  });

  it("says when a comparable is still being built", () => {
    const sen = chosenComparables.projects.find((p) => p.slug === "the-sen")!;
    expect(stillBuilding(sen.comparables[0], chosenComparables.checked)).toBe(true);
    expect(chosenNotes["the-sen"]).toMatch(/under construction/);
    const kassia = chosenComparables.projects.find((p) => p.slug === "kassia")!;
    expect(stillBuilding(kassia.comparables[0], chosenComparables.checked)).toBe(false);
  });
});

describe("comparables' URA records", () => {
  it("finds every chosen comparable in URA's records", () => {
    const names = new Set(chosenComparables.projects.flatMap((p) => p.comparables.map((c) => c.name)));
    for (const n of names) expect(uraComparables.comparables.some((u) => u.name === n), n).toBe(true);
    const kassia = specs.find((s) => s.id === "kassia")!;
    const choice = buildAutoBundle(kassia, traceOf("kassia")).comparableChoice!;
    expect(choice.recordsLoaded).toBe(true);
    expect(choice.records?.[0]?.ura.project).toBe("PARC KOMO");
  });

  it("matches a JadeScape resale in TRM's Huttons report", () => {
    const jade = uraComparables.comparables.find((u) => u.name === "Jadescape")!;
    // Report: 17th floor, 904 sq ft, sold 10 Sep 2026 for $2,390,000.
    expect(jade.recentSales.some(([m, type, floors, area, price]) => m === "2026-09" && type === "resale" && floors === "16-20" && area === 904 && price === 2_390_000)).toBe(true);
  });

  it("works out the change since launch and the gross yield only from enough records", () => {
    const jade = uraComparables.comparables.find((u) => u.name === "Jadescape")!;
    expect(changeSinceLaunch(jade)).toBe(Math.round((jade.resaleLast12.medianPsf! / jade.firstSale!.medianPsf - 1) * 100));
    const y = grossYield(jade)!;
    expect(y).toBeGreaterThan(0.02);
    expect(y).toBeLessThan(0.05);
    const lentor = uraComparables.comparables.find((u) => u.name === "Lentor Modern")!;
    expect(lentor.resaleLast12.count).toBe(0);
    expect(changeSinceLaunch(lentor)).toBeNull();
    expect(grossYield(lentor)).toBeNull();
  });
});
