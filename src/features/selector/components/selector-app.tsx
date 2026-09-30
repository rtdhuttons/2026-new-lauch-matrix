"use client";

import { useMemo, useState } from "react";
import { dataGaps, dataset, mrtEntrance } from "../data";
import type { Unit } from "../model/types";
import { unitLabel } from "../lib/dataset-index";
import { createEngine } from "../lib/engine";
import { compactMoney } from "../lib/format";
import type { Preferences } from "../lib/recommend";
import { DEFAULT_PREFERENCES, rankUnits, recommend } from "../lib/recommend";
import { Comparison } from "./comparison";
import { MethodNotes } from "./method-notes";
import { PreferencesPanel } from "./preferences-panel";
import { Recommendations } from "./recommendations";
import { ScenarioCalculator } from "./scenario-calculator";
import { SiteView } from "./site-view";
import { StackExplorer } from "./stack-explorer";
import { card, SectionHeading } from "./ui";
import { UnitDetails } from "./unit-details";

const MAX_SHORTLIST = 3;

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ block: "start" });
}

export function SelectorApp() {
  const engine = useMemo(() => createEngine(dataset, mrtEntrance), []);
  const ix = engine.ix;

  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [stackId, setStackId] = useState("01");
  const [level, setLevel] = useState(14);
  const [referenceId, setReferenceId] = useState<string | null>(
    () => dataset.units.find((u) => u.stackId === "01" && u.price !== null)?.id ?? null,
  );
  const [shortlist, setShortlist] = useState<string[]>(["01-14", "01-20"]);
  const [month, setMonth] = useState(5);
  const [minutes, setMinutes] = useState(16 * 60);
  const [prefsOpen, setPrefsOpen] = useState(false);

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

  const toggleShortlist = (u: Unit) =>
    setShortlist((list) =>
      list.includes(u.id)
        ? list.filter((id) => id !== u.id)
        : list.length >= MAX_SHORTLIST
          ? list
          : [...list, u.id],
    );

  const candidates = [
    ...(unit ? [unit] : []),
    ...shortlistUnits.filter((u) => u.id !== unit?.id),
  ];

  return (
    <>
      <div className="border-b border-[#e2cf9f] bg-[#f4ead3]">
        <p className="mx-auto max-w-7xl px-4 py-2.5 font-display-normal text-sm text-[#5c3f0b] sm:px-8">
          <strong className="font-semibold">{dataset.project.isDemo ? "Illustrative demo data." : "Work in progress."}</strong>{" "}
          {dataset.project.display?.notice ?? dataset.project.demoNotice}
        </p>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-28 sm:px-8">
        <header className="pb-8 pt-10 sm:pt-14">
          <p className="font-display-normal text-base text-stone">
            {dataset.project.name}
            {dataset.project.isDemo ? ", a fictional demo project" : `, ${dataset.project.totalUnits.toLocaleString("en-SG")} homes in ${dataset.blocks.length} blocks`}
          </p>
          <h1 className="mt-1 font-display text-[2.5rem] font-extrabold leading-[1.02] tracking-tight sm:text-[4rem]">
            Stack &amp; Unit Selector
          </h1>
          <p className="mt-4 max-w-[62ch] text-lg leading-relaxed text-canopy/85">
            Find the stack and floor that suit you, see what changes as you go up, and check whether the extra price for a better floor, facing or view is worth paying.
          </p>
        </header>

        <section id="explore" aria-labelledby="explore-title" className="scroll-mt-20">
          <h2 id="explore-title" className="sr-only">Explore stacks and floors</h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
            <aside aria-label="Your preferences" className="lg:sticky lg:top-20 lg:self-start">
              <div className={`${card} p-4 sm:p-5`}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-lg font-extrabold">Your preferences</h2>
                  <button
                    type="button"
                    aria-expanded={prefsOpen}
                    aria-controls="prefs-body"
                    onClick={() => setPrefsOpen((o) => !o)}
                    className="rounded-full border border-canopy/20 px-3 py-1 font-display-normal text-sm lg:hidden"
                  >
                    {prefsOpen ? "Hide" : "Edit"}
                  </button>
                </div>
                <p className="mt-1 font-display-normal text-sm text-stone lg:hidden">
                  {prefs.bedrooms === "any" ? "Any bedrooms" : `${prefs.bedrooms} bedrooms`}, up to {compactMoney(prefs.budget)}, {eligibleCount} units match
                </p>
                <div id="prefs-body" className={`${prefsOpen ? "block" : "hidden"} mt-4 lg:block lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:pr-1`}>
                  <PreferencesPanel prefs={prefs} onChange={setPrefs} eligibleCount={eligibleCount} />
                </div>
              </div>
            </aside>

            <div className="grid min-w-0 grid-cols-1 gap-6 [&>*]:min-w-0">
              <div className={`${card} p-4 sm:p-6`}>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-extrabold">Site plan</h2>
                    <p className="text-sm text-canopy/75">Spin the development around and tap any unit to see its price, or switch to the flat plan for view, noise, privacy and route overlays.</p>
                  </div>
                  <div>
                    <label htmlFor="stack-select" className="sr-only">Choose a stack</label>
                    <select
                      id="stack-select"
                      value={stackId}
                      onChange={(e) => selectStack(e.target.value)}
                      className="rounded-md border border-canopy/20 bg-paper px-3 py-2 font-display-normal text-sm"
                    >
                      {dataset.stacks.map((s) => {
                        const l = ix.stackLayout(s.id);
                        return (
                          <option key={s.id} value={s.id}>
                            Stack {s.id}, {ix.block(s.blockId).name}
                            {l.bedrooms !== null ? `, ${l.name} (${l.bedrooms} bed)` : ix.block(s.blockId).collection ? `, ${ix.block(s.blockId).collection}` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
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
                />
              </div>

              <StackExplorer
                engine={engine}
                stackId={stackId}
                level={level}
                onLevel={setLevel}
                reference={reference}
                onSetReference={(u) => setReferenceId(u.id)}
                shortlist={shortlist}
                onToggleShortlist={toggleShortlist}
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
          </div>
        </section>

        <section id="recommendations" aria-labelledby="rec-title" className="mt-16 scroll-mt-20">
          <SectionHeading
            id="rec-title"
            title="Recommendations"
            lede="Three separate answers, each with its reasons and trade-offs, based on your preferences and the rules explained below."
          />
          <Recommendations engine={engine} recs={recs} shortlist={shortlist} onOpen={openUnit} onToggleShortlist={toggleShortlist} />
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

        <section id="scenario" aria-labelledby="scenario-title" className="mt-16 scroll-mt-20">
          <SectionHeading
            id="scenario-title"
            title="Premium & resale scenarios"
            lede="What the extra price would need to achieve at resale. The scenarios are assumptions you control, not forecasts."
          />
          <ScenarioCalculator
            engine={engine}
            candidates={candidates}
            reference={reference}
            holdingYears={prefs.holdingYears}
            onHoldingYears={(y) => setPrefs({ ...prefs, holdingYears: y })}
          />
        </section>

        <section id="method" aria-labelledby="method-title" className="mt-16 scroll-mt-20">
          <SectionHeading id="method-title" title="Method and data" />
          <MethodNotes gaps={dataGaps} />
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-canopy/10 bg-paper/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
          <p className="min-w-0 truncate font-display-normal text-sm">
            {unit ? (
              <>
                <span className="font-semibold">{unitLabel(ix, unit)}</span>{" "}
                {unit.price !== null ? compactMoney(unit.price) : "not on sale"}
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
