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
import { estimatePayments, EMPTY_PAYMENT_INPUTS, monthlyInstalment } from "../payments";
import { annualisedSpread, averageScore, entryPsfSteps, EXIT_YEARS, exitProjection, exitPsfSteps, PIVOT_CATEGORIES } from "../pivot";
import { EMPTY_SELLING_INPUTS, estimateProceeds, ILLUSTRATIVE_SELLING_EXAMPLE } from "../selling";
import { checkValuationRequest } from "../valuation";
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
    expect(tr).toContain("Alternative projects");
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

  it("keeps the stated overall separate from the simple average", () => {
    expect(PIVOT_CATEGORIES.map((c) => c.letter).join("")).toBe("PIVOT");
    expect(p.scores!.map((s) => s.score)).toEqual([9, 8, 10, 8, 9]);
    expect(averageScore(p)).toBeCloseTo(8.8, 5);
    expect(p.overallStated).toBe(8.6);
    expect(p.overallMethod).toBeNull();
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
  it("has the seven tabs in order", () => {
    expect(TABS.map((t) => t.label)).toEqual([
      "Project & 3D Site",
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

  it("asks for what's missing, as a problem and a fix", () => {
    const r = estimatePayments(2_000_000, EMPTY_PAYMENT_INPUTS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems).toContain("Enter a loan period to calculate your payment.");
    const noPrice = estimatePayments(null, { ...EMPTY_PAYMENT_INPUTS, loanAmount: 1, interestRatePct: 1, loanYears: 1 });
    expect(noPrice.ok).toBe(false);
  });

  it("splits the down payment between CPF and cash and reconciles", () => {
    const r = estimatePayments(2_000_000, { cashAvailable: 400_000, cpfAvailable: 150_000, loanAmount: 1_500_000, interestRatePct: 3, loanYears: 30, cpfMonthly: 2_000 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v = r.value;
    expect(v.downPayment).toBe(500_000);
    expect(v.cpfForDownPayment + v.cashUpfront).toBe(v.downPayment);
    expect(v.cashUpfront).toBe(350_000);
    expect(v.cashLeft).toBe(50_000);
    expect(v.loanAmount + v.downPayment).toBe(v.price);
    expect(v.cashMonthlyAfterCpf).toBeCloseTo(v.monthlyInstalment - 2_000, 6);
    expect(v.totalInterest).toBeCloseTo(v.monthlyInstalment * 360 - 1_500_000, 6);
  });

  it("refuses a loan above the price", () => {
    const r = estimatePayments(1_000_000, { ...EMPTY_PAYMENT_INPUTS, loanAmount: 1_200_000, interestRatePct: 3, loanYears: 25 });
    expect(r.ok).toBe(false);
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
