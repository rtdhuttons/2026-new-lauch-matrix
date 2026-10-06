"use client";

// The project website, shaped like a consultation: each tab says what the
// buyer can do there, shows the useful information first and puts the
// detail behind named sections, then suggests one next step. Eight tabs in
// a fixed order for every project; the selected unit, the comparison and
// the payment inputs stay as the buyer moves between them. Everything
// project-specific comes from the bundle passed in.

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { site } from "@/content/site";
import type { ProjectBundle } from "../model/project";
import type { Unit } from "../model/types";
import { ownTypeKey, ownUnitTypes, unitModels } from "../lib/alternatives";
import { FLOOR_BANDS } from "../lib/comparable";
import { createEngine } from "../lib/engine";
import type { PriceEstimate } from "../lib/estimate";
import { applyPriceEstimate, canEstimate, describeEstimate, lowestHomeLevel } from "../lib/estimate";
import type { PaymentInputs } from "../lib/payments";
import { DEFAULT_PAYMENT_INPUTS, estimatePayments } from "../lib/payments";
import { compactMoney } from "../lib/format";
import type { Preferences } from "../lib/recommend";
import { DEFAULT_PREFERENCES, rankUnits } from "../lib/recommend";
import type { SellingInputs } from "../lib/selling";
import { EMPTY_SELLING_INPUTS } from "../lib/selling";
import { AlternativesTab } from "./alternatives-tab";
import { AssetImg } from "./asset-image";
import { ComparableChoice } from "./comparable-choice";
import { CompareCards } from "./compare-cards";
import { Comparison } from "./comparison";
import { ExitAppeal } from "./exit-appeal";
import { FloorProfit } from "./floor-profit";
import { LocationSection } from "./location";
import { MatchingHomes } from "./matching-homes";
import { MethodNotes } from "./method-notes";
import type { CalcPick } from "./payment-calculator";
import { PaymentCalculator } from "./payment-calculator";
import { PhotoBand } from "./photo-band";
import { PivotTab } from "./pivot-tab";
import { PlansTab } from "./plans-tab";
import { PriceEstimateSection } from "./price-estimate";
import { Gallery, ProjectHero } from "./project-hero";
import { StartingPrices } from "./starting-prices";
import { RentalPotential } from "./rental-evidence";
import { SchoolsTab } from "./schools-tab";
import { comparisonFeedback, ComparisonBar, MAX_SHORTLIST, ShortlistButton, ShortlistDialog, useShortlistDialog } from "./shortlist";
import { SiteView } from "./site-view";
import { StackExplorer } from "./stack-explorer";
import { StackPriceChart } from "./stack-price-chart";
import type { TabId } from "./tabs";
import { NotSupplied, SectionPager, TabIntro, TabNav, tabFromHash } from "./tabs";
import { btnPrimary, btnSecondary, btnText, card, Disclosure, NextStep, NumbersDisclaimer } from "./ui";
import { UnitDetails } from "./unit-details";
import type { UnitFilterState } from "./unit-filters";
import { UnitFilters } from "./unit-filters";
import { unitNumber, UnitSummary } from "./unit-summary";
import { UpgradingTab } from "./upgrading-tab";

interface SavedSelection {
  shortlist: string[];
  stackId: string;
  level: number;
}

const storageKey = (id: string) => `trm:${id}:selection`;

function loadSelection(id: string): SavedSelection | null {
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    return raw ? (JSON.parse(raw) as SavedSelection) : null;
  } catch {
    return null;
  }
}

function saveSelection(id: string, s: SavedSelection) {
  try {
    window.localStorage.setItem(storageKey(id), JSON.stringify(s));
  } catch {
    // Private windows and blocked storage: the selection still works for this visit.
  }
}

function scrollToId(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "smooth" }));
}

const NO_FILTERS: UnitFilterState = { floorBand: "any", blockId: "any" };

function Step({ n, title, id, children, hint }: { n: number; title: string; id?: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`step-${n}`} className="mt-12 scroll-mt-24 first:mt-0">
      <div className="mb-4 flex items-baseline gap-3">
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-canopy font-display-normal text-sm font-bold text-mist">
          {n}
        </span>
        <div>
          <h3 id={`step-${n}`} className="font-display text-xl font-extrabold">
            <span className="sr-only">Step {n}: </span>
            {title}
          </h3>
          {hint && <p className="mt-0.5 text-[0.9375rem] text-canopy/75">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function ProjectApp({ project }: { project: ProjectBundle }) {
  const dataset = project.dataset;
  const defaults = project.pricing.estimate;
  // Illustrative prices stand in until the developer's price list is loaded.
  const estimatable = defaults !== null && canEstimate(dataset);
  const [estimateOn, setEstimateOn] = useState(estimatable);
  const [estimate, setEstimate] = useState<PriceEstimate | null>(defaults);
  const deferredEstimate = useDeferredValue(estimate);
  const priced = useMemo(
    () => (estimatable && estimateOn && deferredEstimate ? applyPriceEstimate(dataset, deferredEstimate) : dataset),
    [dataset, estimatable, estimateOn, deferredEstimate],
  );
  const engine = useMemo(() => createEngine(priced, project.mrtEntrance ?? { x: 0, y: 0 }), [priced, project.mrtEntrance]);
  const ix = engine.ix;
  const prices = priced.units.flatMap((u) => (u.price !== null ? [u.price] : []));
  const budgetRange = prices.length
    ? { min: Math.floor(Math.min(...prices) / 50_000) * 50_000, max: Math.ceil(Math.max(...prices) / 50_000) * 50_000 }
    : { min: 0, max: 0 };

  const [tab, setTab] = useState<TabId>("project");
  const [prefs, setPrefs] = useState<Preferences>(() => {
    const start = estimatable && defaults ? applyPriceEstimate(dataset, defaults) : dataset;
    const top = Math.max(0, ...start.units.map((u) => u.price ?? 0));
    return top > 0 ? { ...DEFAULT_PREFERENCES, budget: Math.ceil(top / 50_000) * 50_000 } : DEFAULT_PREFERENCES;
  });
  const [filters, setFilters] = useState<UnitFilterState>(NO_FILTERS);
  const [browse, setBrowse] = useState<"site" | "list">("site");
  const [payments, setPayments] = useState<PaymentInputs>(DEFAULT_PAYMENT_INPUTS);
  const [calcPick, setCalcPick] = useState<CalcPick | null>(null);
  const [selling, setSelling] = useState<SellingInputs>(EMPTY_SELLING_INPUTS);
  const [sellingCalculated, setSellingCalculated] = useState<SellingInputs | null>(null);

  const firstStack = dataset.stacks[0]?.id ?? "";
  const [stackId, setStackId] = useState(firstStack);
  const [level, setLevel] = useState(() => {
    const levels = [...new Set(dataset.units.filter((u) => u.stackId === firstStack).map((u) => u.level))].sort((a, b) => a - b);
    return levels[Math.floor(levels.length / 2)] ?? 1;
  });
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [referenceId, setReferenceId] = useState<string | null>(
    () => dataset.units.filter((u) => u.stackId === firstStack).sort((a, b) => a.level - b.level)[0]?.id ?? null,
  );
  const [month, setMonth] = useState(5);
  const [minutes, setMinutes] = useState(16 * 60);
  const [shadowsSignal, setShadowsSignal] = useState(0);
  const [unitQuery, setUnitQuery] = useState("");
  const [unitQueryError, setUnitQueryError] = useState<string | null>(null);
  const shortlistDialog = useShortlistDialog();

  // Restore the last selection and follow the address bar's tab. Saved
  // state is read after hydration (the server can't see it), so the first
  // render matches the server's HTML.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const saved = loadSelection(project.id);
    if (saved) {
      const stackOk = ix.ds.stacks.some((s) => s.id === saved.stackId);
      /* eslint-disable react-hooks/set-state-in-effect -- one-off restore from browser storage after hydration */
      if (stackOk) {
        setStackId(saved.stackId);
        setLevel(saved.level);
      }
      setShortlist(saved.shortlist.filter((id) => ix.unit(id)).slice(0, MAX_SHORTLIST));
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    // "?stack=25" (from the 3D city view) opens that stack.
    const linked = new URLSearchParams(window.location.search).get("stack");
    if (linked && ix.ds.stacks.some((s) => s.id === linked)) {
      const levels = ix.levelsForStack(linked);
      setStackId(linked);
      setLevel(levels[Math.floor(levels.length / 2)] ?? levels[0]);
    }
    setRestored(true); // marks the restore done, so saving starts on the next render
    const follow = () => {
      const t = tabFromHash(window.location.hash);
      if (!t) return;
      setTab(t.tab);
      if (t.section) scrollToId(t.section);
    };
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);
  // Save only after the restore has rendered, so the defaults never overwrite a saved selection.
  useEffect(() => {
    if (restored) saveSelection(project.id, { shortlist, stackId, level });
  }, [restored, project.id, shortlist, stackId, level]);
  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 4500);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const goTo = (t: TabId, section?: string) => {
    setTab(t);
    if (window.location.hash !== `#${t}`) window.history.pushState(null, "", `#${t}`);
    scrollToId(section ?? "project-tabs");
  };

  const ranked = useMemo(() => rankUnits(engine, prefs), [engine, prefs]);

  const unit = ix.unitsInStack(stackId).find((u) => u.level === level) ?? null;
  const reference = referenceId ? ix.unit(referenceId) ?? null : null;
  const shortlistUnits = shortlist.map((id) => ix.unit(id)).filter((u): u is Unit => !!u);
  const payment = unit ? estimatePayments(unit.price, payments) : null;
  const priceNote = estimatable && estimateOn && deferredEstimate ? `Estimate: ${describeEstimate(deferredEstimate, lowestHomeLevel(dataset))}. Not the developer's price.` : null;

  const selectStack = (id: string) => {
    const levels = ix.levelsForStack(id);
    setStackId(id);
    setLevel((l) => Math.min(Math.max(l, levels[0]), levels[levels.length - 1]));
  };
  const selectUnit = (u: Unit) => {
    setStackId(u.stackId);
    setLevel(u.level);
  };
  const viewDetails = (u: Unit) => {
    selectUnit(u);
    goTo("units", "unit-details");
  };

  const showShadowsAt4pm = () => {
    setMinutes(16 * 60);
    setShadowsSignal((n) => n + 1);
    scrollToId("site-plan");
  };

  // "#12-25", "12-25" or "12 25": floor 12, stack 25.
  const goToUnit = (query: string) => {
    const m = query.match(/(\d{1,2})\s*[-–\s]\s*(\d{1,2})/);
    const found = m ? ix.unit(`${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`) : undefined;
    if (!found) {
      setUnitQueryError(m ? `There is no unit #${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}. Check the floor and stack numbers.` : "Type a unit number such as #12-25.");
      return;
    }
    setUnitQueryError(null);
    selectUnit(found);
    scrollToId("unit-details");
  };

  const toggleShortlist = (u: Unit) => {
    if (shortlist.includes(u.id)) {
      setShortlist(shortlist.filter((id) => id !== u.id));
      setFeedback(`Unit ${unitNumber(u)} removed from the comparison.`);
    } else if (shortlist.length >= MAX_SHORTLIST) {
      setFeedback(comparisonFeedback(u, shortlist.length, false));
    } else {
      setShortlist([...shortlist, u.id]);
      setFeedback(comparisonFeedback(u, shortlist.length + 1, true));
    }
  };

  const band = FLOOR_BANDS.find((b) => b.id === filters.floorBand);
  const topStorey = Math.max(...dataset.blocks.map((b) => b.storeys));
  const floorBands = FLOOR_BANDS.filter((b) => b.from <= topStorey).map((b) => ({
    id: b.id,
    label: `${b.label} (floors ${b.from}${Number.isFinite(b.to) && b.to < topStorey ? `–${b.to}` : "+"})`,
  }));
  // Units that match the filters: highlighted in the site view and listed in the unit list.
  const focus = useCallback(
    (u: Unit) =>
      (prefs.bedrooms === "any" || ix.unitLayout(u).bedrooms === prefs.bedrooms) &&
      (u.price === null || u.price <= prefs.budget) &&
      (!band || (u.level >= band.from && u.level <= band.to)) &&
      (filters.blockId === "any" || ix.stackBlock(u.stackId).id === filters.blockId),
    [ix, prefs.bedrooms, prefs.budget, band, filters.blockId],
  );
  const matching = useMemo(() => priced.units.filter(focus), [priced, focus]);
  const bedroomOptions = [...new Set(dataset.layouts.map((l) => l.bedrooms).filter((b): b is number => b !== null))].sort();
  const clearFilters = () => {
    setFilters(NO_FILTERS);
    setPrefs((p) => ({ ...p, bedrooms: "any", budget: budgetRange.max || p.budget }));
  };

  const priceFact =
    estimatable && estimateOn && deferredEstimate
      ? { label: "Estimated price from", value: `$${deferredEstimate.basePsf.toLocaleString("en-SG")} psf` }
      : project.profile.tenure
        ? { label: "Tenure", value: project.profile.tenure }
        : null;
  const heroFacts = [...project.copy.heroFacts];
  if (priceFact) heroFacts.splice(2, 0, priceFact);
  const layoutName = (u: Unit) => {
    const l = ix.unitLayout(u);
    return l.category ?? (l.bedrooms ? `${l.bedrooms}-bedroom` : l.name);
  };

  const summary = (extra?: React.ReactNode) => (
    <UnitSummary
      engine={engine}
      unit={unit}
      stackId={stackId}
      level={level}
      onLevel={setLevel}
      inComparison={unit ? shortlist.includes(unit.id) : false}
      comparisonFull={shortlist.length >= MAX_SHORTLIST}
      onToggleComparison={toggleShortlist}
      onViewPayments={() => goTo("units", "payments")}
      payment={payment?.ok ? payment.value : null}
      priceNote={priceNote}
      mrtName={project.profile.nearestMrt}
      footer={extra}
    />
  );

  const siteView = (
    <SiteView
      engine={engine}
      ranked={ranked}
      selectedStackId={stackId}
      selectedUnit={unit}
      level={level}
      onSelectStack={selectStack}
      onSelectUnit={selectUnit}
      month={month}
      minutes={minutes}
      onMonth={setMonth}
      onMinutes={setMinutes}
      shadowsSignal={shadowsSignal}
      focus={focus}
    />
  );

  /** On phones the details sit below the site view, so offer a jump after a tap. */
  const jumpToDetails = unit && (
    <button type="button" onClick={() => scrollToId("unit-details")} className={`${btnSecondary} mt-3 w-full lg:hidden`}>
      View details of unit {unitNumber(unit)} ↓
    </button>
  );

  const unitSearch = (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        goToUnit(unitQuery);
      }}
      className="flex flex-wrap items-center gap-1.5"
    >
      <label htmlFor="unit-search" className="sr-only">Unit number</label>
      <input
        id="unit-search"
        type="search"
        inputMode="numeric"
        value={unitQuery}
        onChange={(e) => setUnitQuery(e.target.value)}
        placeholder="e.g. #12-25"
        aria-describedby={unitQueryError ? "unit-search-error" : undefined}
        className="w-40 rounded-full border border-canopy/25 bg-paper px-4 py-2 font-display-normal text-sm"
      />
      <button type="submit" className={`${btnSecondary} px-4 py-2`}>
        Show this unit
      </button>
      {unitQueryError && (
        <p id="unit-search-error" role="alert" className="w-full font-display-normal text-sm text-[#9b2f28]">
          {unitQueryError}
        </p>
      )}
    </form>
  );

  const panel = (id: TabId) => ({
    id: `panel-${id}`,
    role: "tabpanel" as const,
    "aria-labelledby": `tab-${id}`,
    className: "mx-auto max-w-7xl px-4 pt-8 sm:px-8",
  });

  const isSample = project.status === "sample";
  const launchText = project.profile.launchDate
    ? new Date(`${project.profile.launchDate.date}T00:00:00Z`).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : null;
  const unitLayout = unit ? ix.unitLayout(unit) : null;
  // Alternatives are always compared at the project's standard estimate (not the visitor's adjustments).
  const ownTypes = useMemo(
    () => ownUnitTypes((estimatable && defaults ? applyPriceEstimate(dataset, defaults) : dataset).units, ix),
    [dataset, estimatable, defaults, ix],
  );
  const calcModels = useMemo(() => unitModels(priced.units, ix), [priced, ix]);
  const selectedOwnType = unitLayout ? ownTypes.find((t) => t.key === ownTypeKey(unitLayout)) ?? null : null;

  const intro = (
    <>
      <p className="mt-5 max-w-[30ch] font-display text-2xl font-extrabold leading-tight sm:text-[2.1rem]">
        Choose the right unit, not just the right project.
      </p>
      <p className="mt-3 max-w-[60ch] text-[1.0625rem] leading-relaxed text-white/90 sm:text-lg">
        An independent buyer&apos;s guide by {site.brand}, {site.brandFull}. Compare all {dataset.units.length.toLocaleString("en-SG")} units by view,
        sun, noise and price, work out your payments and stamp duty, and see how the floor you pick could pay off when you sell.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3 [text-shadow:none]">
        <button type="button" onClick={() => goTo("units")} className="rounded-full bg-white px-6 py-3 font-display-normal text-[0.9375rem] font-semibold text-canopy hover:bg-mist">
          Find my unit
        </button>
        <button type="button" onClick={() => goTo("project", "explore")} className="rounded-full border border-white/50 px-5 py-2.5 font-display-normal text-sm font-semibold text-white hover:bg-white/10">
          See the 3D site
        </button>
        <button type="button" onClick={() => goTo("investor")} className="px-2 py-2 font-display-normal text-sm font-semibold text-white/85 underline underline-offset-4 hover:text-white">
          Investing? View investment analysis
        </button>
      </div>
    </>
  );

  return (
    <>
      <div className={isSample ? "border-b border-[#e8b4ad] bg-[#fbe9e6]" : "border-b border-[#e2cf9f] bg-[#f4ead3]"}>
        <p className={`mx-auto max-w-7xl px-4 py-2 font-display-normal text-sm sm:px-8 ${isSample ? "text-[#7a231b]" : "text-[#5c3f0b]"}`}>
          <strong className="font-semibold">{isSample ? "Sample project — fictional data, not for publication." : estimatable ? "Prices are estimates." : "Work in progress."}</strong>{" "}
          {isSample
            ? dataset.project.display?.notice ?? dataset.project.demoNotice
            : estimatable
              ? `The developer's price list hasn't been released${launchText ? `; sales launch ${launchText}` : ""}. Each section shows its sources and dates.`
              : dataset.project.display?.notice ?? ""}
        </p>
      </div>

      {project.media.hero ? (
        <ProjectHero image={project.media.hero} name={project.profile.name} eyebrow={project.copy.eyebrow} facts={heroFacts}>
          {intro}
        </ProjectHero>
      ) : (
        <section aria-label={`${project.profile.name} at a glance`} className="bg-canopy text-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
            <p className="font-display-normal text-sm font-semibold uppercase tracking-[0.18em] text-white/80">{project.copy.eyebrow}</p>
            <h1 className="mt-2 font-display text-[2.6rem] font-extrabold leading-none tracking-tight sm:text-6xl">{project.profile.name}</h1>
            {intro}
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-white/25 pt-4 sm:grid-cols-4">
              {heroFacts.map((f) => (
                <div key={f.label}>
                  <dt className="font-display-normal text-[0.8125rem] text-white/70">{f.label}</dt>
                  <dd className="font-display-normal text-lg font-semibold">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      <div id="project-tabs" className="scroll-mt-0">
        <TabNav active={tab} onChange={(t) => goTo(t)} shortlistButton={<ShortlistButton count={shortlist.length} onOpen={shortlistDialog.open} />} />
      </div>

      {/* 1. Project & 3D Site */}
      {tab === "project" && (
        <div {...panel("project")}>
          <TabIntro tab="project" />
          <section id="explore" aria-label="Site view" className="scroll-mt-24">
            {project.media.city3d && process.env.NEXT_PUBLIC_SINGLE_PAGE !== "1" && (
              <a href={project.media.city3d} className={`${btnSecondary} mb-3 inline-block px-4 py-2`}>
                See {project.profile.name} in Google&apos;s 3D city
              </a>
            )}
            <p className="mb-3 font-display-normal text-sm text-canopy/75">
              Tap any unit to see its details. Units that don&apos;t match your filters are faded ({matching.length.toLocaleString("en-SG")} of{" "}
              {priced.units.length.toLocaleString("en-SG")} match).{" "}
              <button type="button" onClick={() => goTo("units")} className={btnText}>Change filters</button>
            </p>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] [&>*]:min-w-0">
              <div id="site-plan" className={`${card} scroll-mt-24 p-3 sm:p-4`}>
                {siteView}
                {jumpToDetails}
              </div>
              <div id="unit-details" className="scroll-mt-24 lg:sticky lg:top-20 lg:self-start">
                {summary(
                  unit && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilters({ ...NO_FILTERS, blockId: ix.stackBlock(unit.stackId).id });
                        setBrowse("list");
                        goTo("units", "select-unit");
                      }}
                      className={`${btnText} mt-3 block`}
                    >
                      Explore units in {ix.stackBlock(unit.stackId).name} →
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="mt-6">
              <Disclosure id="analysis" title={`Sun, privacy and view for every floor of stack ${stackId}`} hint="A stack is a column of units directly above one another, with the same layout and facing.">
                <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0">
                  <StackExplorer
                    engine={engine}
                    stackId={stackId}
                    level={level}
                    onLevel={setLevel}
                    reference={reference}
                    onSetReference={(u) => setReferenceId(u.id)}
                    shortlist={shortlist}
                    onToggleShortlist={toggleShortlist}
                    onShowShadows={showShadowsAt4pm}
                  />
                  <UnitDetails engine={engine} unit={unit} reference={reference} month={month} minutes={minutes} onMonth={setMonth} onMinutes={setMinutes} />
                </div>
              </Disclosure>
            </div>
          </section>

          <section id="gallery" aria-labelledby="gallery-title" className="mt-14 scroll-mt-24">
            <h3 id="gallery-title" className="mb-1 font-display text-xl font-extrabold">{project.copy.galleryTitle}</h3>
            <p className="mb-4 text-canopy/75">{project.copy.galleryLede}</p>
            {project.media.gallery.length > 0 ? (
              <Gallery images={project.media.gallery} />
            ) : (
              <NotSupplied title="Renders have not been added for this project." needed={["The developer's renders, each labelled as an artist's impression."]} />
            )}
          </section>

          <section id="location" aria-labelledby="location-title" className="mt-14 scroll-mt-24">
            <h3 id="location-title" className="mb-1 font-display text-xl font-extrabold">{project.copy.locationTitle}</h3>
            <p className="mb-4 text-canopy/75">{project.copy.locationLede}</p>
            {project.location ? (
              <LocationSection location={project.location} projectName={project.profile.name} />
            ) : (
              <NotSupplied title="Location information has not been added for this project." needed={["The developer's location map.", "Nearby transport, nature, food and shopping, from the developer's material."]} />
            )}
          </section>

          <section id="method" className="mt-14 scroll-mt-24">
            <Disclosure title="Assumptions & sources" hint="How each figure is worked out, where it comes from and what's still missing">
              <MethodNotes gaps={project.gaps} sources={project.sources} map={dataset.project.display?.mapContext ? { note: dataset.project.display.mapContext.provenance.note } : null} />
            </Disclosure>
          </section>

          <NextStep note={unit ? `Unit ${unitNumber(unit)} is selected.` : "Ready to look at units?"} label="Explore units" onClick={() => goTo("units")} />
        </div>
      )}

      {/* 2. Plans */}
      {tab === "plans" && (
        <div {...panel("plans")}>
          <TabIntro tab="plans" />
          <PlansTab ix={ix} units={priced.units} selectedUnit={unit} onSelectUnit={selectUnit} onViewUnit={() => goTo("units", "unit-details")} />
          <NextStep note={unit ? `Unit ${unitNumber(unit)} is selected.` : "Found a layout you like?"} label="Explore units" onClick={() => goTo("units")} />
        </div>
      )}

      {/* 2. Units & Payments */}
      {tab === "units" && (
        <div {...panel("units")}>
          <TabIntro tab="units" />

          <Step n={1} title="Choose bedroom type">
            <UnitFilters
              prefs={prefs}
              onPrefs={setPrefs}
              filters={filters}
              onFilters={setFilters}
              bedroomOptions={bedroomOptions}
              budgetMax={budgetRange.max}
              floorBands={floorBands}
              blocks={dataset.blocks.map((b) => ({ id: b.id, name: b.name }))}
              matches={matching.length}
              unitSearch={unitSearch}
              onClear={clearFilters}
            />
          </Step>

          <Step n={2} id="select-unit" title="Select a unit" hint="Browse on the site or as a list; your selection stays the same either way.">
            <div role="group" aria-label="Browse units by" className="mb-4 inline-flex rounded-full border border-canopy/15 bg-paper p-1">
              {([
                ["site", "Site view"],
                ["list", "Unit list"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={browse === id}
                  onClick={() => setBrowse(id)}
                  className={`rounded-full px-5 py-2 font-display-normal text-sm font-semibold ${browse === id ? "bg-canopy text-mist" : "text-canopy/75"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] [&>*]:min-w-0">
              <div>
                {browse === "site" ? (
                  <div id="site-plan" className={`${card} p-3 sm:p-4`}>
                    {siteView}
                    {jumpToDetails}
                  </div>
                ) : (
                  <MatchingHomes
                    engine={engine}
                    units={matching}
                    selectedId={unit?.id ?? null}
                    shortlist={shortlist}
                    onSelect={(u) => {
                      selectUnit(u);
                      if (window.matchMedia("(max-width: 1023px)").matches) scrollToId("unit-details");
                    }}
                    onToggleShortlist={(u) => {
                      // Adding a unit also selects it, so its details and payments follow.
                      if (!shortlist.includes(u.id)) selectUnit(u);
                      toggleShortlist(u);
                    }}
                    shortlistFull={shortlist.length >= MAX_SHORTLIST}
                  />
                )}
              </div>
              <div id="unit-details" className="scroll-mt-24 lg:sticky lg:top-20 lg:self-start">
                {summary()}
              </div>
            </div>
            {unit && <StackPriceChart engine={engine} stackId={stackId} level={level} typeName={layoutName(unit)} priceNote={priceNote} />}
          </Step>

          <PhotoBand image={project.media.tabPhotos?.units} className="mt-12" />

          <Step n={3} id="compare" title="Compare units" hint="Up to three units side by side, with the differences that matter.">
            <CompareCards engine={engine} units={shortlistUnits} payments={payments} onRemove={toggleShortlist} onSelect={viewDetails} />
            {shortlistUnits.length >= 2 && (
              <div className="mt-4">
                <Disclosure title="All factors" hint="Sun, noise and privacy, MRT walk, resale competition and how reliable each figure is">
                  <Comparison
                    engine={engine}
                    shortlist={shortlistUnits}
                    reference={reference}
                    prefs={prefs}
                    onRemove={toggleShortlist}
                    onOpen={viewDetails}
                    onSetReference={(u) => setReferenceId(u.id)}
                  />
                </Disclosure>
                <NextStep note="Seen the differences?" label="Compare payment estimates" onClick={() => scrollToId("payments")} />
              </div>
            )}
          </Step>

          <Step n={4} id="payments" title="Payment estimate" hint="Choose a bedroom type, model and floor, then enter your own figures. Nothing is saved or sent anywhere.">
            <PaymentCalculator
              models={calcModels}
              pick={calcPick}
              onPick={setCalcPick}
              selected={unit && unitLayout ? { key: ownTypeKey(unitLayout), level: unit.level, label: unitNumber(unit) } : null}
              inputs={payments}
              onInputs={setPayments}
              payments={project.payments}
              profile={project.profile}
            />
            {payment?.ok && <NextStep note="Upgrading from a home you own?" label="Plan my upgrade" onClick={() => goTo("upgrading")} />}
          </Step>

          <div className="mt-12 grid gap-3">
            {project.pricing.startingPrices && (
              <Disclosure id="starting-prices" title="Indicative starting prices" hint={project.pricing.startingPrices.headline ?? undefined}>
                <StartingPrices prices={project.pricing.startingPrices} />
              </Disclosure>
            )}
            {estimatable && estimate && defaults && (
              <Disclosure id="prices" title="Price by floor for every unit type" hint={priceNote ?? undefined}>
                <PriceEstimateSection
                  base={dataset}
                  priced={priced}
                  enabled={estimateOn}
                  onEnabled={setEstimateOn}
                  estimate={estimate}
                  onEstimate={setEstimate}
                  defaults={defaults}
                  bedrooms={prefs.bedrooms}
                />
              </Disclosure>
            )}
          </div>
        </div>
      )}

      {/* 3. Schools */}
      {tab === "schools" && (
        <div {...panel("schools")}>
          <TabIntro tab="schools" />
          <PhotoBand image={project.media.tabPhotos?.schools} className="mb-8" />
          <SchoolsTab
            schools={project.schools}
            projectName={project.profile.name}
            map={
              project.location?.map ? (
                <Disclosure title="Location map" hint="The developer's map, showing the schools named here">
                  <figure>
                    <AssetImg src={project.location.map.src} srcSet={project.location.map.srcSet} sizes="(min-width: 1024px) 1100px, 100vw" alt={project.location.map.alt} loading="lazy" className="block h-auto w-full rounded-lg" />
                    <figcaption className="pt-2 font-display-normal text-xs text-stone">{project.location.mapCaption}</figcaption>
                  </figure>
                </Disclosure>
              ) : null
            }
          />
        </div>
      )}

      {/* 4. Investor */}
      {tab === "investor" && (
        <div {...panel("investor")}>
          <TabIntro tab="investor" />
          <section id="floor-profit" aria-labelledby="hist-title" className="scroll-mt-24">
            <h3 id="hist-title" className="font-display text-xl font-extrabold">Past resale results</h3>
            {project.comparables.length > 0 ? (
              project.comparables.map((c) => (
                <div key={c.project.name} className="mt-2">
                  <p className="mb-4 max-w-[72ch] text-[1rem] text-canopy/80">
                    Recorded gains when owners resold at {c.project.name}
                    {c.project.location ? `, ${c.project.location}` : ""}, by floor: sale price minus purchase price, before costs. Not net returns, and not a
                    forecast for {project.profile.name}.
                  </p>
                  <FloorProfit evidence={c} subjectName={project.profile.name} />
                </div>
              ))
            ) : project.comparableChoice ? (
              <div className="mt-3">
                <ComparableChoice choice={project.comparableChoice} projectName={project.profile.name} />
              </div>
            ) : (
              <div className="mt-3">
                <NotSupplied title="Comparable resale records have not been added for this project." needed={["Matched purchase-and-sale records for one or more comparable projects, with why each is relevant."]} />
              </div>
            )}
            <div className="mt-6">
              <Disclosure title={`Exit appeal score${unit ? ` for unit ${unitNumber(unit)}` : ""}`} hint="What it measures and what it can't tell you">
                <ExitAppeal engine={engine} unit={unit} />
              </Disclosure>
            </div>
          </section>
          <PhotoBand image={project.media.tabPhotos?.investor} className="mt-14" />
          <section id="rental" aria-labelledby="rent-title" className="mt-14 scroll-mt-24">
            <h3 id="rent-title" className="mb-3 font-display text-xl font-extrabold">Rental potential</h3>
            <RentalPotential evidence={project.rentals} engine={engine} unit={unit} />
          </section>
          <NextStep note="Reviewed the past results?" label="Explore exit scenarios" onClick={() => goTo("pivot", unit ? "exit-outcomes" : undefined)} />
        </div>
      )}

      {/* 5. Alternative Projects */}
      {tab === "alternatives" && (
        <div {...panel("alternatives")}>
          <TabIntro tab="alternatives" />
          <PhotoBand image={project.media.tabPhotos?.alternatives} className="mb-8" />
          <AlternativesTab
            alternatives={project.alternatives}
            projectName={project.profile.name}
            ownTypes={ownTypes}
            selected={selectedOwnType && unit ? { label: `Unit ${unitNumber(unit)}`, type: selectedOwnType } : null}
            ownPriceNote={estimatable && defaults ? `at $${defaults.basePsf.toLocaleString("en-SG")} psf on the lowest level plus $${defaults.stepPsf} psf per floor` : null}
          />
        </div>
      )}

      {/* 6. PIVOT */}
      {tab === "pivot" && (
        <div {...panel("pivot")}>
          <TabIntro tab="pivot" />
          <PivotTab
            photo={<PhotoBand image={project.media.tabPhotos?.pivot} />}
            models={calcModels}
            start={unit && unitLayout ? { key: ownTypeKey(unitLayout), level: unit.level } : null}
            pivot={project.pivot}
            projectName={project.profile.name}
            unit={unit && unitLayout ? { name: `Unit ${unitNumber(unit)}`, price: unit.price, areaSqft: unitLayout.areaSqft, isEstimate: !!unit.priceIsEstimate, level: unit.level } : null}
            onChooseUnit={() => goTo("units", "select-unit")}
            evidence={
              project.comparables[0]
                ? {
                    project: project.comparables[0].project.name,
                    resales: project.comparables[0].project.transactions.map((t) => ({ floor: t.floor, annualised: t.annualised })),
                    asAt: project.comparables[0].project.provenance.updated,
                  }
                : null
            }
            completionDate={project.profile.expectedCompletion?.date ?? null}
          />
        </div>
      )}

      {/* 7. My Upgrading Plan */}
      {tab === "upgrading" && (
        <div {...panel("upgrading")}>
          <TabIntro tab="upgrading" />
          <PhotoBand image={project.media.tabPhotos?.upgrading} className="mb-8" />
          <UpgradingTab
            projectName={project.profile.name}
            selling={selling}
            onSelling={setSelling}
            calculated={sellingCalculated}
            onCalculate={setSellingCalculated}
            nextHome={
              <div className={`${card} p-5 sm:p-6`}>
                <h3 className="font-display-normal text-lg font-semibold">Your next home</h3>
                {shortlistUnits.length > 0 || unit ? (
                  <ul className="mt-3 grid gap-2 font-display-normal text-sm">
                    {(shortlistUnits.length > 0 ? shortlistUnits : unit ? [unit] : []).map((u) => (
                      <li key={u.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-mist px-4 py-2.5">
                        <span className="font-semibold">Unit {unitNumber(u)} · {layoutName(u)}</span>
                        <span>{u.price !== null ? `${compactMoney(u.price)}${u.priceIsEstimate ? " (estimate)" : ""}` : "price not published"}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-canopy/80">Choose a unit in Units &amp; Payments and it appears here, so you don&apos;t have to enter its price again.</p>
                )}
                {!unit && (
                  <button type="button" onClick={() => goTo("units")} className={`${btnPrimary} mt-4`}>
                    Choose units
                  </button>
                )}
              </div>
            }
          />
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 pb-32 sm:px-8">
        <NumbersDisclaimer className="mt-10" />
        <SectionPager active={tab} onChange={(t) => goTo(t)} />
      </div>

      <ShortlistDialog
        dialogRef={shortlistDialog.ref}
        engine={engine}
        shortlist={shortlistUnits}
        onOpen={viewDetails}
        onRemove={toggleShortlist}
        onCompare={() => goTo("units", "compare")}
      />
      <ComparisonBar shortlist={shortlistUnits} feedback={feedback} onCompare={() => goTo("units", "compare")} onOpenList={shortlistDialog.open} />
    </>
  );
}
