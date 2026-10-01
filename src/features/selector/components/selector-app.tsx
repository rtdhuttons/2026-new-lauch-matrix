"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { dataGaps, dataset, gallery, heroImage, locationMap, mrtEntrance } from "../data";
import type { Unit } from "../model/types";
import { unitLabel } from "../lib/dataset-index";
import { createEngine } from "../lib/engine";
import type { PriceEstimate } from "../lib/estimate";
import { applyPriceEstimate, canEstimate, DEFAULT_ESTIMATE } from "../lib/estimate";
import { compactMoney } from "../lib/format";
import type { Preferences } from "../lib/recommend";
import { DEFAULT_PREFERENCES, rankUnits, recommend } from "../lib/recommend";
import { Comparison } from "./comparison";
import { MethodNotes } from "./method-notes";
import { LocationSection } from "./location";
import { FilterBar } from "./filter-bar";
import { FloorProfit } from "./floor-profit";
import { PreferencesPanel } from "./preferences-panel";
import { UnitPanel } from "./unit-panel";
import { Gallery, ProjectHero } from "./project-hero";
import { PriceEstimateSection } from "./price-estimate";
import { Recommendations } from "./recommendations";
import { SiteView } from "./site-view";
import { StackExplorer } from "./stack-explorer";
import { card, SectionHeading } from "./ui";
import { UnitDetails } from "./unit-details";

const MAX_SHORTLIST = 3;

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ block: "start" });
}

export function SelectorApp() {
  // Illustrative prices stand in until the developer's price list is loaded.
  const estimatable = canEstimate(dataset);
  const [estimateOn, setEstimateOn] = useState(estimatable);
  const [estimate, setEstimate] = useState<PriceEstimate>(DEFAULT_ESTIMATE);
  const deferredEstimate = useDeferredValue(estimate);
  const priced = useMemo(
    () => (estimatable && estimateOn ? applyPriceEstimate(dataset, deferredEstimate) : dataset),
    [estimatable, estimateOn, deferredEstimate],
  );
  const engine = useMemo(() => createEngine(priced, mrtEntrance), [priced]);
  const ix = engine.ix;
  const prices = priced.units.flatMap((u) => (u.price !== null ? [u.price] : []));
  const budgetRange = prices.length
    ? { min: Math.floor(Math.min(...prices) / 50_000) * 50_000, max: Math.ceil(Math.max(...prices) / 50_000) * 50_000 }
    : { min: 1_300_000, max: 3_600_000 };

  const [prefs, setPrefs] = useState<Preferences>(() => {
    const start = estimatable ? applyPriceEstimate(dataset, DEFAULT_ESTIMATE) : dataset;
    const top = Math.max(0, ...start.units.map((u) => u.price ?? 0));
    return top > 0 ? { ...DEFAULT_PREFERENCES, budget: Math.ceil(top / 50_000) * 50_000 } : DEFAULT_PREFERENCES;
  });
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [stackId, setStackId] = useState("01");
  const [level, setLevel] = useState(14);
  const [referenceId, setReferenceId] = useState<string | null>(
    () =>
      (estimatable ? applyPriceEstimate(dataset, DEFAULT_ESTIMATE) : dataset).units.find(
        (u) => u.stackId === "01" && u.price !== null,
      )?.id ?? null,
  );
  const [shortlist, setShortlist] = useState<string[]>(["01-14", "01-20"]);
  const [month, setMonth] = useState(5);
  const [minutes, setMinutes] = useState(16 * 60);
  const [shadowsSignal, setShadowsSignal] = useState(0);
  const [unitQuery, setUnitQuery] = useState("");
  const [unitQueryError, setUnitQueryError] = useState<string | null>(null);

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

  const openUnit = (u: Unit) => {
    setStackId(u.stackId);
    setLevel(u.level);
    scrollToId("explore");
  };

  const showShadowsAt4pm = () => {
    setMinutes(16 * 60);
    setShadowsSignal((n) => n + 1);
    scrollToId("site-plan");
  };

  // "#12-25", "12-25" or "12 25": level 12, stack 25.
  const goToUnit = (query: string) => {
    const m = query.match(/(\d{1,2})\s*[-–\s]\s*(\d{1,2})/);
    const found = m
      ? ix.unit(`${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`)
      : undefined;
    if (!found) {
      setUnitQueryError(m ? `There is no home #${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}.` : "Type a unit number such as #12-25.");
      return;
    }
    setUnitQueryError(null);
    setStackId(found.stackId);
    setLevel(found.level);
  };

  const toggleShortlist = (u: Unit) =>
    setShortlist((list) =>
      list.includes(u.id)
        ? list.filter((id) => id !== u.id)
        : list.length >= MAX_SHORTLIST
          ? list
          : [...list, u.id],
    );

  // Homes that match the bedroom and budget filters, highlighted in 3D.
  const focus = useCallback(
    (u: Unit) =>
      (prefs.bedrooms === "any" || ix.stackLayout(u.stackId).bedrooms === prefs.bedrooms) &&
      (u.price === null || u.price <= prefs.budget),
    [ix, prefs.bedrooms, prefs.budget],
  );
  const matches = priced.units.filter(focus).length;
  const bedroomOptions = [...new Set(dataset.layouts.map((l) => l.bedrooms).filter((b): b is number => b !== null))].sort();

  const openAnalysis = () => {
    setAnalysisOpen(true);
    requestAnimationFrame(() => scrollToId("analysis"));
  };

  return (
    <>
      <div className="border-b border-[#e2cf9f] bg-[#f4ead3]">
        <p className="mx-auto max-w-7xl px-4 py-2.5 font-display-normal text-sm text-[#5c3f0b] sm:px-8">
          <strong className="font-semibold">{dataset.project.isDemo ? "Illustrative demo data." : "Work in progress."}</strong>{" "}
          {dataset.project.display?.notice ?? dataset.project.demoNotice}
        </p>
      </div>

      <ProjectHero
        image={heroImage}
        name={dataset.project.name}
        eyebrow="Bright Hill Drive · Upper Thomson · Stack & Unit Selector"
        facts={[
          { label: "Homes", value: dataset.project.totalUnits.toLocaleString("en-SG") },
          { label: "Towers", value: `${dataset.blocks.length}, of 21 and 30 storeys` },
          {
            label: estimatable && estimateOn ? "Illustrative price from" : "Tenure",
            value: estimatable && estimateOn ? `$${deferredEstimate.basePsf.toLocaleString("en-SG")} psf` : dataset.project.tenure,
          },
          { label: "Upper Thomson MRT", value: "65 m covered link" },
        ]}
      >
        <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-white/90 sm:text-xl">
          A sanctuary between the reservoirs and the city. Find your stack and floor, see how the view and the sun change as you rise, and what each level could cost.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 [text-shadow:none]">
          <a href="#explore" className="rounded-full bg-white px-5 py-2.5 font-display-normal text-sm font-semibold text-canopy hover:bg-mist">
            Explore stacks and floors
          </a>
          {estimatable && (
            <a href="#prices" className="rounded-full border border-white/60 px-5 py-2.5 font-display-normal text-sm font-semibold text-white hover:bg-white/10">
              See prices by level
            </a>
          )}
        </div>
      </ProjectHero>

      <div className="mx-auto max-w-7xl px-4 pb-28 pt-10 sm:px-8">


        <section id="explore" aria-labelledby="explore-title" className="scroll-mt-20">
          <SectionHeading
            id="explore-title"
            title="Find your home"
            lede="Choose a bedroom count or budget, then tap any home on the model to see its price and floor plan."
          />
          <FilterBar
            prefs={prefs}
            onChange={setPrefs}
            bedroomOptions={bedroomOptions}
            budgetMax={budgetRange.max}
            matches={matches}
            unitSearch={
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
            }
          />

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] [&>*]:min-w-0">
            <div id="site-plan" className={`${card} scroll-mt-20 p-3 sm:p-4`}>
              <SiteView
                engine={engine}
                ranked={ranked}
                selectedStackId={stackId}
                selectedUnit={unit}
                level={level}
                onSelectStack={selectStack}
                onSelectUnit={(u) => {
                  setStackId(u.stackId);
                  setLevel(u.level);
                }}
                month={month}
                minutes={minutes}
                onMonth={setMonth}
                onMinutes={setMinutes}
                shadowsSignal={shadowsSignal}
                focus={focus}
              />
            </div>
            <div className="lg:sticky lg:top-20 lg:self-start">
              <UnitPanel
                engine={engine}
                stackId={stackId}
                unit={unit}
                level={level}
                onLevel={setLevel}
                onCompare={toggleShortlist}
                inCompare={unit ? shortlist.includes(unit.id) : false}
                compareFull={shortlist.length >= MAX_SHORTLIST}
                onFullAnalysis={openAnalysis}
              />
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
                <span className="block font-display text-lg font-extrabold">Full analysis of stack {stackId}</span>
                <span className="block text-sm text-canopy/75">Every floor&apos;s price and view, sun, noise and privacy, MRT walk and resale competition.</span>
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
              <UnitDetails
                engine={engine}
                unit={unit}
                reference={reference}
                month={month}
                minutes={minutes}
                onMonth={setMonth}
                onMinutes={setMinutes}
              />
            </div>
          </details>
        </section>

        {estimatable && (
          <section id="prices" aria-labelledby="prices-title" className="mt-16 scroll-mt-20">
            <SectionHeading
              id="prices-title"
              title="Illustrative prices"
              lede="The price list isn't out yet. Set a starting PSF and a step per floor to see what each unit type could cost; every price in the selector follows these assumptions."
            />
            <PriceEstimateSection
              base={dataset}
              priced={priced}
              enabled={estimateOn}
              onEnabled={setEstimateOn}
              estimate={estimate}
              onEstimate={setEstimate}
              bedrooms={prefs.bedrooms}
            />
          </section>
        )}

        {dataset.comparable && (
          <section id="floor-profit" aria-labelledby="floor-profit-title" className="mt-16 scroll-mt-20">
            <SectionHeading
              id="floor-profit-title"
              title="Profit by floor band"
              lede={`Does a higher floor pay off? What owners made when they resold at ${dataset.comparable.name}, a comparable development nearby, averaged across all bedroom types.`}
            />
            <FloorProfit project={dataset.comparable} imageSrc={gallery.find((g) => g.src.endsWith("/lawn.jpg"))?.src ?? gallery[0].src} />
          </section>
        )}

        <section id="gallery" aria-labelledby="gallery-title" className="mt-16 scroll-mt-20">
          <SectionHeading
            id="gallery-title"
            title="Life at Thomson Reserve"
            lede="Three clubs, a chain of pools shaped like the reservoirs next door, and towers set to face the green."
          />
          <Gallery images={gallery} />
        </section>

        <section id="location" aria-labelledby="location-title" className="mt-16 scroll-mt-20">
          <SectionHeading
            id="location-title"
            title="Where city meets reserve"
            lede="On Upper Thomson Road, with the MRT at the gate, the Central Catchment forest to the west and Bishan's schools and malls to the east."
          />
          <LocationSection map={locationMap} />
        </section>


        <section id="recommendations" aria-labelledby="rec-title" className="mt-16 scroll-mt-20">
          <SectionHeading
            id="rec-title"
            title="Recommendations"
            lede="Three separate answers, each with its reasons and trade-offs, based on your preferences and the rules explained below."
          />
          <Recommendations engine={engine} recs={recs} shortlist={shortlist} onOpen={openUnit} onToggleShortlist={toggleShortlist} />
          <details className="mt-4 rounded-2xl border border-canopy/10 bg-paper">
            <summary className="cursor-pointer px-5 py-4 font-display-normal text-sm font-semibold">
              Fine-tune your preferences ({eligibleCount} homes meet them)
            </summary>
            <div className="border-t border-canopy/10 p-5">
              <PreferencesPanel prefs={prefs} onChange={setPrefs} eligibleCount={eligibleCount} budgetRange={budgetRange} />
            </div>
          </details>
        </section>

        <section id="compare" aria-labelledby="compare-title" className="mt-16 scroll-mt-20">
          <SectionHeading
            id="compare-title"
            title="Compare your shortlist"
            lede="Up to three units side by side across all six frameworks, with layout differences and data confidence."
          />
          <Comparison
            engine={engine}
            shortlist={shortlistUnits}
            reference={reference}
            prefs={prefs}
            onRemove={toggleShortlist}
            onOpen={openUnit}
            onSetReference={(u) => setReferenceId(u.id)}
          />
        </section>

        <section id="method" aria-labelledby="method-title" className="mt-16 scroll-mt-20">
          <details className="rounded-2xl border border-canopy/10 bg-paper">
            <summary className="cursor-pointer px-5 py-4">
              <span id="method-title" className="font-display text-lg font-extrabold">How this works and where the data comes from</span>
            </summary>
            <div className="border-t border-canopy/10 p-3 sm:p-5">
              <MethodNotes gaps={dataGaps} />
            </div>
          </details>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-canopy/10 bg-paper/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
          <p className="min-w-0 truncate font-display-normal text-sm">
            {unit ? (
              <>
                <span className="font-semibold">{unitLabel(ix, unit)}</span>{" "}
                {unit.price !== null ? `${compactMoney(unit.price)}${unit.priceIsEstimate ? " est." : ""}` : "not on sale"}
              </>
            ) : (
              `Level ${level}: no homes`
            )}
          </p>
          <a href="#compare" className="shrink-0 rounded-full bg-canopy px-4 py-2 font-display-normal text-sm font-semibold text-mist">
            Compare ({shortlist.length})
          </a>
        </div>
      </div>
    </>
  );
}
