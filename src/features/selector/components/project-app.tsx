"use client";

// The project website: seven tabs in a fixed order for every project, with
// the selected home and the shortlist kept as the buyer moves between them.
// Everything project-specific comes from the bundle passed in.

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { ProjectBundle } from "../model/project";
import type { Unit } from "../model/types";
import { FLOOR_BANDS } from "../lib/comparable";
import { createEngine } from "../lib/engine";
import type { PriceEstimate } from "../lib/estimate";
import { applyPriceEstimate, averagePsf, canEstimate } from "../lib/estimate";
import { compactMoney, money } from "../lib/format";
import type { Preferences, Purpose } from "../lib/recommend";
import { DEFAULT_PREFERENCES, rankUnits, recommend } from "../lib/recommend";
import { AssetImg } from "./asset-image";
import { Comparison } from "./comparison";
import { ExitAppeal } from "./exit-appeal";
import { FilterBar } from "./filter-bar";
import { FloorPlan } from "./floor-plan";
import { FloorProfit } from "./floor-profit";
import { LocationSection } from "./location";
import { MatchingHomes } from "./matching-homes";
import { MethodNotes } from "./method-notes";
import { PivotTab } from "./pivot-tab";
import { PreferencesPanel } from "./preferences-panel";
import { PriceEstimateSection } from "./price-estimate";
import { Gallery, ProjectHero } from "./project-hero";
import { Recommendations } from "./recommendations";
import { RentalPotential } from "./rental-evidence";
import { SchoolsTab } from "./schools-tab";
import { MAX_SHORTLIST, ShortlistBar } from "./shortlist";
import { SiteView } from "./site-view";
import { StackExplorer } from "./stack-explorer";
import type { TabId } from "./tabs";
import { NotSupplied, TabNav, tabFromHash, TABS } from "./tabs";
import { card, SectionHeading } from "./ui";
import { UnitDetails } from "./unit-details";
import { UnitPanel } from "./unit-panel";

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
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
}

const JOURNEYS: { purpose: Purpose; title: string; body: string; steps: { tab: TabId; label: string }[] }[] = [
  {
    purpose: "own",
    title: "Buying to live in",
    body: "Start with the views, sun and floor plans, then check schools and what you'd pay each month.",
    steps: [
      { tab: "units", label: "Find a home" },
      { tab: "schools", label: "Schools" },
      { tab: "upgrading", label: "My Upgrading Plan" },
    ],
  },
  {
    purpose: "invest",
    title: "Buying to invest",
    body: "Start with past resale profits and rents at a comparable project, then test the PIVOT assessment.",
    steps: [
      { tab: "investor", label: "Investor" },
      { tab: "pivot", label: "PIVOT" },
      { tab: "alternatives", label: "Alternatives" },
    ],
  },
];

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
  const [floorBand, setFloorBand] = useState("any");

  const firstStack = dataset.stacks[0]?.id ?? "";
  const [stackId, setStackId] = useState(firstStack);
  const [level, setLevel] = useState(() => {
    const levels = [...new Set(dataset.units.filter((u) => u.stackId === firstStack).map((u) => u.level))].sort((a, b) => a - b);
    return levels[Math.floor(levels.length / 2)] ?? 1;
  });
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [referenceId, setReferenceId] = useState<string | null>(
    () => dataset.units.filter((u) => u.stackId === firstStack).sort((a, b) => a.level - b.level)[0]?.id ?? null,
  );
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [month, setMonth] = useState(5);
  const [minutes, setMinutes] = useState(16 * 60);
  const [shadowsSignal, setShadowsSignal] = useState(0);
  const [unitQuery, setUnitQuery] = useState("");
  const [unitQueryError, setUnitQueryError] = useState<string | null>(null);

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

  const goTo = (t: TabId, section?: string) => {
    setTab(t);
    if (window.location.hash !== `#${t}`) window.history.pushState(null, "", `#${t}`);
    scrollToId(section ?? "project-tabs");
  };

  const ranked = useMemo(() => rankUnits(engine, prefs), [engine, prefs]);
  const recs = useMemo(() => recommend(ranked), [ranked]);
  const eligibleCount = ranked.filter((r) => r.eligible).length;

  const unit = ix.unitsInStack(stackId).find((u) => u.level === level) ?? null;
  const reference = referenceId ? ix.unit(referenceId) ?? null : null;
  const shortlistUnits = shortlist.map((id) => ix.unit(id)).filter((u): u is Unit => !!u);

  const selectStack = (id: string) => {
    const levels = ix.levelsForStack(id);
    setStackId(id);
    setLevel((l) => Math.min(Math.max(l, levels[0]), levels[levels.length - 1]));
  };
  const selectUnit = (u: Unit) => {
    setStackId(u.stackId);
    setLevel(u.level);
  };
  const openInUnits = (u?: Unit) => {
    if (u) selectUnit(u);
    goTo("units", "units-selected");
  };

  const showShadowsAt4pm = () => {
    setMinutes(16 * 60);
    setShadowsSignal((n) => n + 1);
    scrollToId("site-plan");
  };

  // "#12-25", "12-25" or "12 25": level 12, stack 25.
  const goToUnit = (query: string) => {
    const m = query.match(/(\d{1,2})\s*[-–\s]\s*(\d{1,2})/);
    const found = m ? ix.unit(`${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`) : undefined;
    if (!found) {
      setUnitQueryError(m ? `There is no home #${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}.` : "Type a unit number such as #12-25.");
      return;
    }
    setUnitQueryError(null);
    selectUnit(found);
  };

  const toggleShortlist = (u: Unit) =>
    setShortlist((list) => (list.includes(u.id) ? list.filter((id) => id !== u.id) : list.length >= MAX_SHORTLIST ? list : [...list, u.id]));

  const band = FLOOR_BANDS.find((b) => b.id === floorBand);
  const topStorey = Math.max(...dataset.blocks.map((b) => b.storeys));
  const floorBands = FLOOR_BANDS.filter((b) => b.from <= topStorey).map((b) => ({
    id: b.id,
    label: `${b.label} (${b.from}${Number.isFinite(b.to) && b.to < topStorey ? `–${b.to}` : "+"})`,
  }));
  // Homes that match the filters, highlighted in 3D and listed in Units & Payments.
  const focus = useCallback(
    (u: Unit) =>
      (prefs.bedrooms === "any" || ix.stackLayout(u.stackId).bedrooms === prefs.bedrooms) &&
      (u.price === null || u.price <= prefs.budget) &&
      (!band || (u.level >= band.from && u.level <= band.to)),
    [ix, prefs.bedrooms, prefs.budget, band],
  );
  const matching = useMemo(() => priced.units.filter(focus), [priced, focus]);
  const bedroomOptions = [...new Set(dataset.layouts.map((l) => l.bedrooms).filter((b): b is number => b !== null))].sort();

  const openAnalysis = () => {
    setAnalysisOpen(true);
    scrollToId("analysis");
  };

  const priceFact =
    estimatable && estimateOn && deferredEstimate
      ? { label: "Illustrative price from", value: `$${deferredEstimate.basePsf.toLocaleString("en-SG")} psf` }
      : project.profile.tenure
        ? { label: "Tenure", value: project.profile.tenure }
        : null;
  const heroFacts = [...project.copy.heroFacts];
  if (priceFact) heroFacts.splice(2, 0, priceFact);

  const unitPanelProps = {
    engine,
    stackId,
    unit,
    level,
    onLevel: setLevel,
    onCompare: toggleShortlist,
    inCompare: unit ? shortlist.includes(unit.id) : false,
    compareFull: shortlist.length >= MAX_SHORTLIST,
    onFullAnalysis: () => {
      goTo("project");
      openAnalysis();
    },
    mrtName: project.profile.nearestMrt,
  };

  const unitSearch = (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        goToUnit(unitQuery);
      }}
      className="flex flex-wrap items-center gap-1.5"
    >
      <label htmlFor="unit-search" className="sr-only">Go to a unit number</label>
      <input
        id="unit-search"
        type="search"
        inputMode="numeric"
        value={unitQuery}
        onChange={(e) => setUnitQuery(e.target.value)}
        placeholder="Unit no., e.g. #12-25"
        aria-describedby={unitQueryError ? "unit-search-error" : undefined}
        className="w-44 rounded-full border border-canopy/15 bg-paper px-4 py-2 font-display-normal text-sm"
      />
      <button type="submit" className="rounded-full bg-canopy px-4 py-2 font-display-normal text-sm font-semibold text-mist">
        Go
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
    hidden: tab !== id,
    className: "mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-8",
  });

  const isSample = project.status === "sample";
  const avgPsf = estimatable && estimateOn && deferredEstimate ? averagePsf(dataset, deferredEstimate) : null;

  return (
    <>
      <div className={isSample ? "border-b border-[#e8b4ad] bg-[#fbe9e6]" : "border-b border-[#e2cf9f] bg-[#f4ead3]"}>
        <p className={`mx-auto max-w-7xl px-4 py-2.5 font-display-normal text-sm sm:px-8 ${isSample ? "text-[#7a231b]" : "text-[#5c3f0b]"}`}>
          <strong className="font-semibold">{isSample ? "Sample project — fictional data, not for publication." : "Work in progress."}</strong>{" "}
          {dataset.project.display?.notice ?? dataset.project.demoNotice}
        </p>
      </div>

      {project.media.hero ? (
        <ProjectHero image={project.media.hero} name={project.profile.name} eyebrow={project.copy.eyebrow} facts={heroFacts}>
          <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-white/90 sm:text-xl">{project.copy.tagline}</p>
        </ProjectHero>
      ) : (
        <section aria-label={`${project.profile.name} at a glance`} className="bg-canopy text-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
            <p className="font-display-normal text-sm font-semibold uppercase tracking-[0.18em] text-white/80">{project.copy.eyebrow}</p>
            <h1 className="mt-2 font-display text-[2.6rem] font-extrabold leading-none tracking-tight sm:text-6xl">{project.profile.name}</h1>
            <p className="mt-4 max-w-[60ch] text-lg text-white/85">{project.copy.tagline}</p>
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
        <TabNav active={tab} onChange={(t) => goTo(t)} />
      </div>

      {/* 1. Project & 3D Site — kept mounted so the 3D view keeps its camera between tabs. */}
      <div {...panel("project")}>
        <div className="grid gap-4 sm:grid-cols-2">
          {JOURNEYS.map((j) => (
            <div key={j.purpose} className={`${card} p-5 ${prefs.purpose === j.purpose ? "ring-2 ring-canopy" : ""}`}>
              <p className="font-display text-lg font-extrabold">{j.title}</p>
              <p className="mt-1 text-[0.9375rem] text-canopy/80">{j.body}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {j.steps.map((s) => (
                  <button
                    key={s.tab}
                    type="button"
                    onClick={() => {
                      setPrefs((p) => ({ ...p, purpose: j.purpose }));
                      goTo(s.tab);
                    }}
                    className="rounded-full border border-canopy/20 px-3.5 py-1.5 font-display-normal text-sm font-semibold hover:bg-mist-deep"
                  >
                    {s.label} →
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <section id="explore" aria-labelledby="explore-title" className="mt-10 scroll-mt-20">
          <SectionHeading id="explore-title" title="The site in 3D" lede="Tap any home on the model for its price, facing and view, then open it in Units & Payments for the floor plan and costs." />
          <p className="-mt-2 mb-4 font-display-normal text-sm text-canopy/75">
            {matching.length.toLocaleString("en-SG")} of {priced.units.length.toLocaleString("en-SG")} homes match your filters; the rest are faded.{" "}
            <button type="button" onClick={() => goTo("units")} className="font-semibold text-reservoir underline underline-offset-4">
              Change filters
            </button>
          </p>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] [&>*]:min-w-0">
            <div id="site-plan" className={`${card} scroll-mt-20 p-3 sm:p-4`}>
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
            </div>
            <div className="lg:sticky lg:top-20 lg:self-start">
              <UnitPanel {...unitPanelProps} onOpenUnits={() => openInUnits()} />
            </div>
          </div>

          <details
            id="analysis"
            open={analysisOpen}
            onToggle={(e) => setAnalysisOpen(e.currentTarget.open)}
            className="group mt-6 scroll-mt-20 rounded-2xl border border-canopy/10 bg-paper"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-display-normal [&::-webkit-details-marker]:hidden">
              <span>
                <span className="block font-display text-lg font-extrabold">Sun, facing, privacy and view: stack {stackId}</span>
                <span className="block text-sm text-canopy/75">Every floor&apos;s view clearance, afternoon sun, noise and privacy, and walk to the MRT.</span>
              </span>
              <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full border border-canopy/20 text-lg transition-transform group-open:rotate-45">+</span>
            </summary>
            <div className="grid grid-cols-1 gap-6 border-t border-canopy/10 p-3 sm:p-5 [&>*]:min-w-0">
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
          </details>
        </section>

        <section id="gallery" aria-labelledby="gallery-title" className="mt-16 scroll-mt-20">
          <SectionHeading id="gallery-title" title={project.copy.galleryTitle} lede={project.copy.galleryLede} />
          {project.media.gallery.length > 0 ? (
            <Gallery images={project.media.gallery} />
          ) : (
            <NotSupplied title="Renders and photos" needed={["The developer's renders, each labelled as an artist's impression."]} />
          )}
        </section>

        <section id="location" aria-labelledby="location-title" className="mt-16 scroll-mt-20">
          <SectionHeading id="location-title" title={project.copy.locationTitle} lede={project.copy.locationLede} />
          {project.location ? (
            <LocationSection location={project.location} projectName={project.profile.name} />
          ) : (
            <NotSupplied title="Location" needed={["The developer's location map.", "Nearby transport, nature, food and shopping, from the developer's material."]} />
          )}
        </section>

        <section id="method" aria-labelledby="method-title" className="mt-16 scroll-mt-20">
          <details className="rounded-2xl border border-canopy/10 bg-paper">
            <summary className="cursor-pointer px-5 py-4">
              <span id="method-title" className="font-display text-lg font-extrabold">How this works and where the data comes from</span>
            </summary>
            <div className="border-t border-canopy/10 p-3 sm:p-5">
              <MethodNotes gaps={project.gaps} sources={project.sources} map={dataset.project.display?.mapContext ? { note: dataset.project.display.mapContext.provenance.note } : null} />
            </div>
          </details>
        </section>
      </div>

      {/* 2. Units & Payments */}
      {tab === "units" && (
        <div {...panel("units")}>
          <SectionHeading title="Units & Payments" lede="Choose a bedroom count, budget or floor, pick a home, and compare up to three." />
          <FilterBar
            prefs={prefs}
            onChange={setPrefs}
            bedroomOptions={bedroomOptions}
            budgetMax={budgetRange.max}
            matches={matching.length}
            unitSearch={unitSearch}
            floorBand={floorBand}
            floorBands={floorBands}
            onFloorBand={setFloorBand}
          />

          <section id="units-selected" aria-label="Selected home" className="mt-6 grid scroll-mt-20 grid-cols-1 gap-6 lg:grid-cols-[380px_minmax(0,1fr)] [&>*]:min-w-0">
            <UnitPanel {...unitPanelProps} showPlan={false} />
            <div className={`${card} p-3 sm:p-4`}>
              {unit?.floorPlan ? (
                <FloorPlan unit={unit} />
              ) : (
                <p className="p-4 text-canopy/75">{unit ? "No floor plan supplied for this home's type yet." : "Select a home to see its floor plan."}</p>
              )}
            </div>
          </section>

          <section aria-labelledby="matching-title" className="mt-10">
            <h2 id="matching-title" className="mb-3 font-display text-xl font-extrabold">Homes that match</h2>
            <MatchingHomes
              engine={engine}
              units={matching}
              selectedId={unit?.id ?? null}
              shortlist={shortlist}
              onSelect={(u) => {
                selectUnit(u);
                scrollToId("units-selected");
              }}
              onToggleShortlist={toggleShortlist}
              shortlistFull={shortlist.length >= MAX_SHORTLIST}
            />
          </section>

          <section id="compare" aria-labelledby="compare-title" className="mt-14 scroll-mt-20">
            <SectionHeading id="compare-title" title="Compare your shortlist" lede="Up to three homes side by side: layout, facing, view, price and premiums, with data confidence." />
            <Comparison
              engine={engine}
              shortlist={shortlistUnits}
              reference={reference}
              prefs={prefs}
              onRemove={toggleShortlist}
              onOpen={(u) => {
                selectUnit(u);
                scrollToId("units-selected");
              }}
              onSetReference={(u) => setReferenceId(u.id)}
            />
          </section>

          <section id="payments" aria-labelledby="payments-title" className="mt-14 scroll-mt-20">
            <SectionHeading id="payments-title" title="Payments and affordability" lede="Cash and CPF needed, progress payments during construction, and monthly loan payments." />
            <NotSupplied
              title="Payment and affordability planner"
              needed={[
                "The developer's payment schedule for this project.",
                "The latest dated price list and availability.",
                "Maintenance fee estimates, if available.",
                "Any financing examples you want to use (fictional buyers only).",
              ]}
            >
              <p>
                {project.profile.expectedCompletion
                  ? `Known so far: expected vacant possession ${new Date(`${project.profile.expectedCompletion.date}T00:00:00Z`).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })} (${project.profile.expectedCompletion.provenance.source}). ${project.profile.expectedCompletion.provenance.note ?? ""}`
                  : "Expected completion date not supplied."}
              </p>
              <p className="mt-1">
                The planner will use the shortlisted homes above, so prices won&apos;t need to be typed in again. Until a dated price list arrives, any prices
                it uses stay marked as estimates.
              </p>
            </NotSupplied>
          </section>

          {estimatable && estimate && defaults && (
            <section id="prices" aria-labelledby="prices-title" className="mt-14 scroll-mt-20">
              <SectionHeading
                id="prices-title"
                title="Illustrative prices"
                lede="The price list isn't out yet. Set a starting PSF and a step per floor to see what each unit type could cost; every price on the site follows these assumptions."
              />
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
            </section>
          )}

          <section id="recommendations" aria-labelledby="rec-title" className="mt-14 scroll-mt-20">
            <SectionHeading id="rec-title" title="Recommendations" lede="Three separate answers, each with its reasons and trade-offs, based on your filters and preferences." />
            <Recommendations
              engine={engine}
              recs={recs}
              shortlist={shortlist}
              onOpen={(u) => {
                selectUnit(u);
                scrollToId("units-selected");
              }}
              onToggleShortlist={toggleShortlist}
            />
            <details className="mt-4 rounded-2xl border border-canopy/10 bg-paper">
              <summary className="cursor-pointer px-5 py-4 font-display-normal text-sm font-semibold">Fine-tune your preferences ({eligibleCount} homes meet them)</summary>
              <div className="border-t border-canopy/10 p-5">
                <PreferencesPanel prefs={prefs} onChange={setPrefs} eligibleCount={eligibleCount} budgetRange={budgetRange} />
              </div>
            </details>
          </section>
        </div>
      )}

      {/* 3. Schools */}
      {tab === "schools" && (
        <div {...panel("schools")}>
          <SchoolsTab
            schools={project.schools}
            projectName={project.profile.name}
            map={
              project.location?.map ? (
                <figure className={`${card} overflow-hidden p-0`}>
                  <AssetImg src={project.location.map.src} srcSet={project.location.map.srcSet} sizes="(min-width: 1024px) 1100px, 100vw" alt={project.location.map.alt} loading="lazy" className="block h-auto w-full" />
                  <figcaption className="px-4 py-2.5 font-display-normal text-xs text-stone">{project.location.mapCaption}</figcaption>
                </figure>
              ) : null
            }
          />
        </div>
      )}

      {/* 4. Investor */}
      {tab === "investor" && (
        <div {...panel("investor")}>
          <SectionHeading title="Investor" lede="What owners made when they resold at a comparable project, and what similar homes rent for." />
          <section id="floor-profit" aria-labelledby="hist-title" className="scroll-mt-20">
            <h2 id="hist-title" className="mb-1 font-display text-2xl font-extrabold">Historical profitability</h2>
            {project.comparables.length > 0 ? (
              project.comparables.map((c) => (
                <div key={c.project.name} className="mt-4">
                  <p className="mb-4 max-w-[72ch] text-[1rem] text-canopy/80">
                    Recorded gross gains (sale price minus purchase price, before costs) at {c.project.name}
                    {c.project.location ? `, ${c.project.location}` : ""}, by floor band. Not net returns.
                  </p>
                  <FloorProfit evidence={c} subjectName={project.profile.name} />
                </div>
              ))
            ) : (
              <NotSupplied title="Comparison project resales" needed={["Matched purchase-and-sale records for one or more comparable projects, with why each is relevant."]} />
            )}
            <div className="mt-6">
              <ExitAppeal engine={engine} unit={unit} />
            </div>
          </section>
          <section id="rental" aria-labelledby="rent-title" className="mt-14 scroll-mt-20">
            <h2 id="rent-title" className="mb-3 font-display text-2xl font-extrabold">Rental potential</h2>
            <RentalPotential evidence={project.rentals} engine={engine} unit={unit} />
          </section>
        </div>
      )}

      {/* 5. Alternative Projects */}
      {tab === "alternatives" && (
        <div {...panel("alternatives")}>
          <SectionHeading title="Alternative Projects" lede={`How ${project.profile.name} compares with other projects within your budget.`} />
          {project.alternatives.length > 0 ? (
            <div className={`${card} overflow-x-auto p-0`}>
              <table className="w-full min-w-[720px] border-collapse font-display-normal text-sm">
                <thead>
                  <tr className="bg-canopy text-left text-xs uppercase tracking-[0.08em] text-mist">
                    <th className="px-4 py-3">Project</th>
                    <th className="px-3 py-3">Why consider it</th>
                    <th className="px-3 py-3">Tenure</th>
                    <th className="px-3 py-3">Completion</th>
                    <th className="px-4 py-3">Prices (labelled)</th>
                  </tr>
                </thead>
                <tbody>
                  {project.alternatives.map((a) => (
                    <tr key={a.name} className="border-t border-canopy/10 align-top">
                      <th scope="row" className="px-4 py-3 text-left font-semibold">{a.name}</th>
                      <td className="px-3 py-3">{a.why}</td>
                      <td className="px-3 py-3">{a.tenure ?? "—"}</td>
                      <td className="px-3 py-3">{a.completion ?? "—"}</td>
                      <td className="px-4 py-3">
                        {a.prices.map((p, i) => (
                          <span key={i} className="block">
                            {p.basis === "asking" ? "Asking" : p.basis === "developer-guide" ? "Developer guide" : "Transacted"}: {p.price !== null ? money(p.price) : "—"}
                            {p.psf !== null ? ` ($${p.psf.toLocaleString("en-SG")} psf)` : ""} · {p.date}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <NotSupplied
              title="Alternative projects"
              needed={[
                "An initial shortlist of three to five alternative projects, new launches or resale.",
                "Why you consider each one relevant.",
                "Their factsheets, floor plans, and dated prices: developer guide prices, asking prices and transacted prices, each labelled.",
              ]}
            >
              Comparisons will use similar unit types and dated evidence, with asking, guide and transacted prices kept separate.
            </NotSupplied>
          )}
        </div>
      )}

      {/* 6. PIVOT */}
      {tab === "pivot" && (
        <div {...panel("pivot")}>
          <PivotTab pivot={project.pivot} projectName={project.profile.name} illustrativeAveragePsf={avgPsf} />
        </div>
      )}

      {/* 7. My Upgrading Plan */}
      {tab === "upgrading" && (
        <div {...panel("upgrading")}>
          <SectionHeading title="My Upgrading Plan" lede="For homeowners moving up: what your current home frees up, when, and whether it covers the next one." />
          <div className={`${card} p-5 sm:p-6`}>
            <h3 className="font-display text-lg font-extrabold">Your next home</h3>
            {shortlistUnits.length > 0 || unit ? (
              <ul className="mt-3 grid gap-2 font-display-normal text-sm">
                {(shortlistUnits.length > 0 ? shortlistUnits : unit ? [unit] : []).map((u) => (
                  <li key={u.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-mist px-4 py-2.5">
                    <span className="font-semibold">{ix.stackBlock(u.stackId).name} #{String(u.level).padStart(2, "0")}-{u.stackId}</span>
                    <span>{u.price !== null ? `${compactMoney(u.price)}${u.priceIsEstimate ? " (estimate)" : ""}` : "price not published"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-canopy/80">Shortlist a home in Units &amp; Payments and it appears here, so its price needn&apos;t be typed again.</p>
            )}
          </div>
          <div className="mt-6">
            <NotSupplied
              title="Upgrading planner"
              needed={[
                "One fictional upgrader case to build and test against.",
                "Your usual consultation sequence.",
                "Moving-cost and temporary accommodation assumptions.",
                "Any planning worksheet you already use.",
              ]}
            >
              The planner will show the current home&apos;s sale proceeds, outstanding loan, CPF refund and selling costs; compare selling first with buying
              first; and flag overlapping payments and cash gaps. Sale proceeds are never counted before the assumed completion date.
            </NotSupplied>
          </div>
        </div>
      )}

      <ShortlistBar
        engine={engine}
        selected={unit}
        shortlist={shortlistUnits}
        onOpen={(u) => openInUnits(u)}
        onRemove={toggleShortlist}
        onCompare={() => goTo("units", "compare")}
      />
    </>
  );
}

export { TABS };
