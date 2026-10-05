import { describe, expect, it } from "vitest";
import { sampleProject } from "../../data/demo/bundle";
import { projects } from "../../data/projects";
import { thomsonReserve } from "../../data/thomson-reserve/bundle";
import { tabFromHash, TABS } from "../../components/tabs";
import { comparisonFeedback } from "../../components/shortlist";
import { differenceSentence } from "../../components/compare-cards";
import { createEngine } from "../engine";
import { applyPriceEstimate } from "../estimate";
import * as estimate from "../estimate";
import { DEFAULT_PAYMENT_INPUTS, estimatePayments, loanSchedule, monthlyInstalment } from "../payments";
import { niceTicks, waterfallColumns } from "../../components/charts";
import { annualisedSpread, averageScore, entryPsfSteps, EXIT_YEARS, exitProjection, exitPsfSteps, PIVOT_CATEGORIES } from "../pivot";
import { EMPTY_SELLING_INPUTS, estimateProceeds, ILLUSTRATIVE_SELLING_EXAMPLE } from "../selling";
import { checkValuationRequest } from "../valuation";
import { closestBySize, ownUnitTypes, sizePriceSentence, unitModels } from "../alternatives";
import { progressivePayments, STANDARD_SCHEDULE } from "../progressive";
import { applyListing } from "../listing";
import { buyerStampDuty, stampDuty } from "../stamp-duty";
import { huttonsSync } from "../../data/thomson-reserve/huttons-units";
import { alternativesSync } from "../../data/thomson-reserve/alternatives-huttons";
import { thomsonReserveDataset } from "../../data/thomson-reserve/index";
import { indexDataset } from "../dataset-index";
import { jadescape } from "../../data/comparables/jadescape";
import { floorBand } from "../comparable";
import { checkProject } from "../project-check";
import { recentRecords, rentsByBedrooms, rentsBySize, rentsForSize, summariseRents } from "../rentals";

describe("project bundles", () => {
  it("pass the project check with no errors", () => {
    expect(checkProject(thomsonReserve).errors).toEqual([]);
    expect(checkProject(sampleProject).errors).toEqual([]);
  });

  it("list what each project is still missing", () => {
    const tr = checkProject(thomsonReserve).missing;
    expect(tr).toContain("Developer's price list");
    expect(tr).toContain("Payment schedule");
    expect(tr).not.toContain("Alternative projects");
    expect(tr).not.toContain("PIVOT assessment");
    expect(tr).not.toContain("Rental evidence");
    expect(checkProject(sampleProject).missing).toContain("Gallery images");
  });

  it("keeps Thomson Reserve's rules and pricing in its own data", () => {
    expect(thomsonReserve.pricing.estimate).toEqual({ basePsf: 2850, stepPsf: 15 });
    expect("DEFAULT_ESTIMATE" in estimate).toBe(false);
    const firstLevels = Object.fromEntries(thomsonReserve.dataset.blocks.map((b) => [b.id, b.firstResidentialLevel]));
    expect(firstLevels).toMatchObject({ "5": 1, "7": 1, "1": 2, "3": 2, "9": 2, "11": 2 });
    expect(thomsonReserve.dataset.stacks.every((s) => s.observedClearance)).toBe(true);
  });

  it("lets nothing from Thomson Reserve leak into the sample project", () => {
    const text = JSON.stringify(sampleProject);
    for (const word of ["Thomson", "JadeScape", "Bright Hill", "Ai Tong", "Upper Thomson", "Windsor", "Sin Ming", "Huttons", "PIVOT e-book"]) {
      expect(text, word).not.toContain(word);
    }
    expect(sampleProject.pricing.estimate).toBeNull();
    expect(sampleProject.dataset.stacks.some((s) => s.observedClearance)).toBe(false);
    expect(sampleProject.schools).toBeNull();
    expect(sampleProject.status).toBe("sample");
  });

  it("registers each project once, with only live ones listed", () => {
    expect(new Set(projects.map((p) => p.id)).size).toBe(projects.length);
    expect(projects.find((p) => p.id === sampleProject.id)?.status).toBe("sample");
    expect(projects.find((p) => p.id === thomsonReserve.id)?.status).toBe("live");
  });

  it("records a checked date and kind for every source", () => {
    for (const r of thomsonReserve.sources) {
      expect(r.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.kind).toBeTruthy();
    }
    const kinds = new Set(thomsonReserve.sources.map((r) => r.kind));
    for (const k of ["developer", "agent", "calculated", "illustrative", "third-party"]) expect(kinds.has(k as never)).toBe(true);
  });
});

describe("PIVOT", () => {
  const p = thomsonReserve.pivot;

  it("reproduces the e-book's entry price from the land bid", () => {
    const e = entryPsfSteps(p.entry!);
    expect(e.cost).toBe(1878);
    expect(e.withMargin).toBeCloseTo(2159.7, 1);
    expect(Math.round(e.estimate)).toBe(p.entry!.statedPsf);
  });

  it("reproduces the e-book's exit benchmark", () => {
    const x = exitPsfSteps(p.exit!);
    expect(x.years).toBe(15);
    expect(x.beforeUplift).toBe(2950);
    expect(Math.round(x.estimate)).toBe(p.exit!.statedPsf);
  });

  it("states the overall rating as the average of the five scores", () => {
    expect(PIVOT_CATEGORIES.map((c) => c.letter).join("")).toBe("PIVOT");
    expect(p.scores!.map((s) => s.score)).toEqual([9, 8, 10, 8, 9]);
    expect(averageScore(p)).toBeCloseTo(8.8, 5);
    expect(p.overallStated).toBe(8.8);
    expect(p.overallMethod).toMatch(/average of the five scores/);
  });
});

describe("rental evidence", () => {
  const records = thomsonReserve.rentals[0].records;

  it("keeps every lease, and leaves missing bedroom counts unassigned", () => {
    expect(records).toHaveLength(881);
    const byBeds = rentsByBedrooms(records);
    expect(byBeds.reduce((a, r) => a + r.leases, 0)).toBe(881);
    expect(byBeds.find((r) => r.label === "Bedrooms not recorded")?.leases).toBe(26);
    expect(byBeds.find((r) => r.label === "2-bedroom")?.leases).toBe(353);
  });

  it("summarises by size band and finds the band for a home", () => {
    expect(rentsBySize(records).reduce((a, r) => a + r.leases, 0)).toBe(881);
    expect(rentsForSize(records, 1055).every((r) => r.areaSqft.min === 1000 && r.areaSqft.max === 1100)).toBe(true);
    expect(rentsForSize(records, 1055)).toHaveLength(50);
  });

  it("filters the last 12 months from the latest lease", () => {
    const recent = recentRecords(records, 12);
    expect(recent.every((r) => r.month >= "2025-09-01")).toBe(true);
    expect(recent.some((r) => r.month === "2026-08-01")).toBe(true);
  });

  it("reports median, quartiles and range", () => {
    const s = summariseRents("t", [
      { month: "2026-01-01", areaSqft: { min: 500, max: 600 }, monthlyRent: 3000, bedrooms: 1 },
      { month: "2026-02-01", areaSqft: { min: 500, max: 600 }, monthlyRent: 4000, bedrooms: 1 },
      { month: "2026-03-01", areaSqft: { min: 500, max: 600 }, monthlyRent: 5000, bedrooms: 1 },
    ])!;
    expect([s.median, s.low, s.high, s.q1, s.q3, s.leases, s.latest]).toEqual([4000, 3000, 5000, 3500, 4500, 3, "2026-03-01"]);
    expect(summariseRents("none", [])).toBeNull();
  });
});

describe("tabs", () => {
  it("has the eight tabs in order", () => {
    expect(TABS.map((t) => t.label)).toEqual([
      "Project & 3D Site",
      "Plans",
      "Units & Payments",
      "Schools",
      "Investor",
      "Alternative Projects",
      "PIVOT",
      "My Upgrading Plan",
    ]);
  });

  it("opens the right tab for old section links", () => {
    expect(tabFromHash("#prices")).toEqual({ tab: "units", section: "prices" });
    expect(tabFromHash("#compare")).toEqual({ tab: "units", section: "compare" });
    expect(tabFromHash("#floor-profit")).toEqual({ tab: "investor", section: "floor-profit" });
    expect(tabFromHash("#explore")).toEqual({ tab: "project", section: "explore" });
    expect(tabFromHash("#pivot")).toEqual({ tab: "pivot", section: null });
    expect(tabFromHash("#nothing")).toBeNull();
    expect(tabFromHash("")).toBeNull();
  });
});


describe("payment estimate", () => {
  it("uses the standard fixed-rate repayment", () => {
    // $1,000,000 at 3% over 30 years: about $4,216 a month.
    expect(monthlyInstalment(1_000_000, 3, 30)).toBeCloseTo(4216.04, 1);
    expect(monthlyInstalment(120_000, 0, 10)).toBe(1000);
  });

  it("starts at 75% LTV, 2% a year over 25 years", () => {
    expect(DEFAULT_PAYMENT_INPUTS).toEqual({ buyer: "sc-1", ltvPct: 75, interestRatePct: 2, loanYears: 25 });
  });

  it("works out the loan from the LTV, and the down payment from the rest", () => {
    const r = estimatePayments(2_000_000, DEFAULT_PAYMENT_INPUTS);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v = r.value;
    expect(v.loanAmount).toBe(1_500_000);
    expect(v.downPayment).toBe(500_000);
    expect(v.minCash).toBe(100_000);
    expect(v.monthlyInstalment).toBeCloseTo(monthlyInstalment(1_500_000, 2, 25), 6);
    expect(v.totalInterest).toBeCloseTo(v.monthlyInstalment * 300 - 1_500_000, 6);
  });

  it("asks for what's missing, as a problem and a fix", () => {
    const r = estimatePayments(2_000_000, { ...DEFAULT_PAYMENT_INPUTS, loanYears: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems).toContain("Enter a loan period to calculate your payment.");
    expect(estimatePayments(null, DEFAULT_PAYMENT_INPUTS).ok).toBe(false);
  });

  it("keeps the 5% booking fee in cash", () => {
    expect(estimatePayments(1_000_000, { ...DEFAULT_PAYMENT_INPUTS, ltvPct: 96 }).ok).toBe(false);
  });
});

describe("comparison wording", () => {
  const priced = applyPriceEstimate(thomsonReserve.dataset, thomsonReserve.pricing.estimate!);
  const engine = createEngine(priced, thomsonReserve.mrtEntrance!);
  const u = (id: string) => engine.ix.unit(id)!;

  it("gives the feedback messages", () => {
    expect(comparisonFeedback(u("25-12"), 1, true)).toBe("Unit #12-25 added. You can compare 2 more units.");
    expect(comparisonFeedback(u("25-12"), 2, true)).toBe("Unit #12-25 added. You can compare 1 more unit.");
    expect(comparisonFeedback(u("25-12"), 3, false)).toBe("You're comparing 3 units. Remove one to add another.");
  });

  it("explains differences in plain words", () => {
    // Same stack, five floors apart: $15 psf a floor on the same size.
    const low = u("01-14");
    const high = u("01-19");
    const size = engine.ix.stackLayout("01").areaSqft!;
    const diff = high.price! - low.price!;
    expect(Math.abs(diff - 5 * 15 * size)).toBeLessThan(1000);
    expect(differenceSentence(engine, high, low)).toBe(`Costs S$${diff.toLocaleString("en-SG")} more and is 5 floors higher than #14-01.`);
    expect(differenceSentence(engine, low, low)).toBe("Same price, size, floor and facing as #14-01.");
  });
});

describe("PIVOT exit projection", () => {
  it("uses JadeScape's median yearly return across all resales", () => {
    const all = annualisedSpread(jadescape.transactions.map((t) => t.annualised))!;
    expect(all.n).toBe(321);
    expect(all.median).toBeCloseTo(0.0534, 4);
    expect(all.q1).toBeLessThan(all.median);
    expect(all.q3).toBeGreaterThan(all.median);
    const high = annualisedSpread(jadescape.transactions.filter((t) => floorBand(t.floor) === "high").map((t) => t.annualised))!;
    expect(high.n).toBe(39);
  });

  it("grows the purchase price each year from +4 to +10 years", () => {
    expect(EXIT_YEARS).toEqual([4, 5, 6, 7, 8, 9, 10]);
    const rows = exitProjection(2_000_000, 0.05);
    expect(rows[0].years).toBe(4);
    expect(rows[0].value).toBeCloseTo(2_000_000 * 1.05 ** 4, 6);
    expect(rows.at(-1)!.gain).toBeCloseTo(2_000_000 * (1.05 ** 10 - 1), 6);
    expect(annualisedSpread([])).toBeNull();
  });
});

describe("selling calculator", () => {
  it("reproduces the illustrative example", () => {
    const before = estimateProceeds({ ...ILLUSTRATIVE_SELLING_EXAMPLE, otherCosts: null });
    expect(before.ok && before.value.beforeCosts).toBe(400_000);
    expect(before.ok && before.value.afterCosts).toBeNull();
    const after = estimateProceeds(ILLUSTRATIVE_SELLING_EXAMPLE);
    expect(after.ok && after.value.afterCosts).toBe(375_000);
    expect(after.ok && after.value.headline).toBe(375_000);
  });

  it("never treats a missing loan or CPF refund as zero", () => {
    const r = estimateProceeds({ ...EMPTY_SELLING_INPUTS, sellingPrice: 1_000_000 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.problems).toContain("Enter your outstanding housing loan (enter 0 if there is none).");
      expect(r.problems).toContain("Enter the total CPF refund for all owners (enter 0 if no CPF was used).");
    }
    const zeros = estimateProceeds({ ...EMPTY_SELLING_INPUTS, sellingPrice: 1_000_000, outstandingLoan: 0, cpfRefund: 0 });
    expect(zeros.ok && zeros.value.beforeCosts).toBe(1_000_000);
  });

  it("flags a shortfall instead of hiding it", () => {
    const r = estimateProceeds({ ...EMPTY_SELLING_INPUTS, sellingPrice: 800_000, outstandingLoan: 500_000, cpfRefund: 350_000 });
    expect(r.ok && r.value.shortfall).toBe(true);
    expect(r.ok && r.value.beforeCosts).toBe(-50_000);
  });
});

describe("valuation request", () => {
  const base = { project: "x", address: "123 Example Road", unitNumber: "", name: "Alex Tan", contactMethod: "mobile" as const, contact: "9123 4567" };
  it("needs an address, a name and one way to reach you", () => {
    expect(checkValuationRequest(base)).toBeNull();
    expect(checkValuationRequest({ ...base, address: "" })).toMatch(/address/);
    expect(checkValuationRequest({ ...base, name: "" })).toMatch(/name/);
    expect(checkValuationRequest({ ...base, contact: "123" })).toMatch(/mobile/);
    expect(checkValuationRequest({ ...base, contactMethod: "email", contact: "alex@example.com" })).toBeNull();
    expect(checkValuationRequest({ ...base, contactMethod: "email", contact: "alex" })).toMatch(/email/);
  });
});

describe("alternative projects", () => {
  it("lists four alternatives with dated, sourced prices", () => {
    expect(thomsonReserve.alternatives.map((a) => a.name)).toEqual(["Lentor Gardens Residences", "Lentoria", "Springleaf Residence", "Chuan Park"]);
    for (const a of thomsonReserve.alternatives) {
      expect(a.provenance.updated).toBe(alternativesSync.fetched);
      expect(a.provenance.source).toBe("Huttons New Launch API");
      expect(a.unitTypes.length).toBeGreaterThan(0);
    }
    expect(sampleProject.alternatives).toEqual([]);
  });

  it("compares Thomson Reserve's types size for size", () => {
    const priced = applyPriceEstimate(thomsonReserve.dataset, thomsonReserve.pricing.estimate!);
    const own = ownUnitTypes(priced.units, indexDataset(priced));
    const units = own.reduce((n, t) => n + t.units, 0);
    expect(units).toBe(priced.units.filter((u) => u.price !== null).length);
    const threeBed = own.find((t) => t.bedrooms === 3)!;
    const lentor = thomsonReserve.alternatives[0];
    const match = closestBySize(threeBed, lentor.unitTypes)!;
    expect(match.bedrooms).toBe(3);
    expect(sizePriceSentence(threeBed, match)).toMatch(/sq ft (larger|smaller)|same size|Within/);
  });

  it("words the difference in size and price", () => {
    const own = { key: "x", bedrooms: 2, type: "2BR", sizeSqft: 700, fromPrice: 2_000_000, isEstimate: true, units: 10 };
    expect(sizePriceSentence(own, { bedrooms: 2, type: "y", sizeSqft: { min: 646, max: 678 }, fromPrice: 1_571_300, unitsLeft: 34 })).toBe(
      "About 22–54 sq ft smaller, with a starting price about S$429,000 lower.",
    );
  });
});

describe("chart figures", () => {
  it("pays the loan down to zero, with interest matching the repayments", () => {
    const sched = loanSchedule(1_000_000, 3, 30);
    expect(sched).toHaveLength(31);
    expect(sched[0].balance).toBe(1_000_000);
    expect(sched.at(-1)!.balance).toBeCloseTo(0, 2);
    expect(sched.at(-1)!.interestPaid).toBeCloseTo(monthlyInstalment(1_000_000, 3, 30) * 360 - 1_000_000, 2);
    // Interest is front-loaded: less than half the loan is repaid by the halfway year.
    expect(sched[15].principalPaid).toBeLessThan(500_000);
  });

  it("builds the selling waterfall from the illustrative example", () => {
    const cols = waterfallColumns([
      { label: "Selling price", value: 1_000_000, kind: "total" },
      { label: "Housing loan", value: -350_000, kind: "change" },
      { label: "CPF refund", value: -250_000, kind: "change" },
      { label: "Cash proceeds", value: 400_000, kind: "total" },
    ]);
    expect(cols.map((c) => [c.from, c.to])).toEqual([
      [0, 1_000_000],
      [1_000_000, 650_000],
      [650_000, 400_000],
      [0, 400_000],
    ]);
  });

  it("chooses round axis ticks that cover the data", () => {
    const t = niceTicks(2_960_000, 3_320_000, 4);
    expect(t[0]).toBeLessThanOrEqual(2_960_000);
    expect(t.at(-1)!).toBeGreaterThanOrEqual(3_320_000);
    expect(t.every((v) => v % 50_000 === 0)).toBe(true);
  });

  it("gives every alternative a developer, tenure and source for its facts", () => {
    for (const a of thomsonReserve.alternatives) {
      expect(a.developer).toBeTruthy();
      expect(a.tenure).toBe("99-year leasehold");
      expect(a.totalUnits).toBeGreaterThan(0);
      expect(a.factsSource?.checked).toBe("2026-10-03");
    }
  });
});

describe("progressive payments", () => {
  it("uses the standard stages, adding up to 100%", () => {
    expect(STANDARD_SCHEDULE.map((s) => s.percent)).toEqual([5, 15, 10, 10, 5, 5, 5, 5, 25, 15]);
  });

  it("pays the first stages from the down payment, then draws the loan", () => {
    const r = progressivePayments(1_000_000, { loanAmount: 750_000, interestRatePct: 3, loanYears: 30 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [booking, sp, foundation, frame] = r.stages;
    expect([booking.own, booking.loan, booking.cashOnly]).toEqual([50_000, 0, true]);
    expect([sp.own, sp.loan]).toEqual([150_000, 0]);
    // The 25% down payment covers half of the foundation stage; the loan pays the rest.
    expect([foundation.own, foundation.loan]).toEqual([50_000, 50_000]);
    expect(frame.loan).toBe(100_000);
    expect(r.totals).toEqual({ own: 250_000, loan: 750_000 });
    expect(r.stages.at(-1)!.loanDrawn).toBe(750_000);
    expect(r.stages.at(-1)!.monthly).toBeCloseTo(monthlyInstalment(750_000, 3, 30), 6);
    expect(foundation.monthly).toBeLessThan(r.stages.at(-1)!.monthly);
  });

  it("keeps the booking fee in cash", () => {
    const r = progressivePayments(1_000_000, { loanAmount: 980_000, interestRatePct: 3, loanYears: 30 });
    expect(r.ok).toBe(false);
  });

  it("lists each model with its floors and prices", () => {
    const priced = applyPriceEstimate(thomsonReserve.dataset, thomsonReserve.pricing.estimate!);
    const models = unitModels(priced.units, indexDataset(priced));
    expect(new Set(models.map((m) => m.bedrooms))).toEqual(new Set([2, 3, 4, 5]));
    expect(models.filter((m) => m.bedrooms === 3).length).toBeGreaterThanOrEqual(3);
    const units = models.reduce((n, m) => n + m.levels.reduce((k, l) => k + l.unitIds.length, 0), 0);
    expect(units).toBe(priced.units.length);
    for (const m of models) expect(m.levels.map((l) => l.price)).toEqual([...m.levels.map((l) => l.price)].sort((a, b) => a - b));
  });
});

describe("developer listing (Huttons New Launch API)", () => {
  it("matches every Thomson Reserve unit by block, stack and floor", () => {
    const r = applyListing(thomsonReserveDataset, huttonsSync);
    expect(huttonsSync.units).toHaveLength(1268);
    expect(r.matched).toBe(1268);
    expect(r.unmatched).toEqual([]);
    // No prices released yet: units are available and the estimate still stands in.
    expect(r.priced).toBe(0);
    expect(r.dataset.units.every((u) => u.status === "available" && u.price === null)).toBe(true);
    expect(thomsonReserve.pricing.priceList).toBeNull();
    const est = applyPriceEstimate(r.dataset, thomsonReserve.pricing.estimate!);
    expect(est.units.every((u) => u.priceIsEstimate && u.price! > 0)).toBe(true);
  });

  it("uses a published price in place of the estimate, and keeps sold units unpriced by the estimate", () => {
    const [first, second] = huttonsSync.units;
    const listing = {
      ...huttonsSync,
      units: [
        [first[0], first[1], first[2], first[3], first[4], "available", 3_200_000, 3_100_000],
        [second[0], second[1], second[2], second[3], second[4], "sold", null, null],
      ] as typeof huttonsSync.units,
    };
    const r = applyListing(thomsonReserveDataset, listing);
    expect(r.priced).toBe(1);
    const priced = r.dataset.units.find((u) => u.price !== null)!;
    expect(priced.price).toBe(3_100_000);
    expect(priced.priceIsEstimate).toBe(false);
    expect(r.dataset.units.filter((u) => u.status === "sold")).toHaveLength(1);
  });

  it("gives the sales launch date", () => {
    expect(thomsonReserve.profile.launchDate?.date).toBe("2026-10-31");
  });
});

describe("stamp duty", () => {
  it("applies the IRAS Buyer's Stamp Duty bands", () => {
    expect(buyerStampDuty(1_000_000)).toBe(24_600);
    expect(buyerStampDuty(3_181_000)).toBe(130_460);
  });

  it("adds Additional Buyer's Stamp Duty by buyer type", () => {
    expect(stampDuty(2_000_000, "sc-1").absd).toBe(0);
    expect(stampDuty(2_000_000, "sc-2").absd).toBe(400_000);
    expect(stampDuty(2_000_000, "pr-1").absd).toBe(100_000);
    expect(stampDuty(2_000_000, "foreigner").absd).toBe(1_200_000);
  });

  it("counts stamp duty in the money needed upfront", () => {
    const r = estimatePayments(2_000_000, { ...DEFAULT_PAYMENT_INPUTS, buyer: "sc-2" });
    expect(r.ok && r.value.upfront).toBe(500_000 + buyerStampDuty(2_000_000) + 400_000);
  });
});

describe("distances between blocks", () => {
  const distances = thomsonReserveDataset.project.display?.distances ?? [];

  it("redraws the architect's figures on the site plan at its scale", () => {
    expect(distances.length).toBeGreaterThan(15);
    for (const d of distances) {
      const drawn = Math.hypot(d.to.x - d.from.x, d.to.y - d.from.y);
      // Each line, measured on the plan, is within 20% of the printed figure.
      expect(Math.abs(drawn - d.metres) / d.metres, d.between).toBeLessThan(0.2);
    }
  });

  it("names the closest towers and is not shared with the sample project", () => {
    const blocks = distances.filter((d) => d.kind === "blocks");
    expect(Math.min(...blocks.map((d) => d.metres))).toBe(26);
    expect(sampleProject.dataset.project.display?.distances).toBeUndefined();
  });
});
