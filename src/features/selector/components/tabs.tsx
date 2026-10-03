"use client";

// The seven main tabs, in a fixed order for every project, their one-line
// introductions, and the shared "not added yet" card used wherever a project
// hasn't supplied the data.

import { useEffect, useRef, useState } from "react";
import { card } from "./ui";

export type TabId = "project" | "units" | "schools" | "investor" | "alternatives" | "pivot" | "upgrading";

export const TABS: { id: TabId; label: string; intro: string }[] = [
  { id: "project", label: "Project & 3D Site", intro: "Explore the development and see where each block and unit sits." },
  { id: "units", label: "Units & Payments", intro: "Choose up to three units to compare prices, layouts, and estimated payments." },
  { id: "schools", label: "Schools", intro: "Explore nearby primary schools and understand the registration considerations." },
  { id: "investor", label: "Investor", intro: "Review past resale results and rental potential using comparable properties." },
  { id: "alternatives", label: "Alternative Projects", intro: "See what other projects offer within a similar budget." },
  { id: "pivot", label: "PIVOT", intro: "Assess your selected unit's entry price and explore possible exit outcomes." },
  { id: "upgrading", label: "My Upgrading Plan", intro: "Start with your current home. Request a valuation report or estimate how much cash you could receive from selling." },
];

/** Older links (#prices, #compare, …) open the tab that now holds that section. */
const SECTION_TAB: Record<string, TabId> = {
  explore: "project",
  "site-plan": "project",
  analysis: "project",
  gallery: "project",
  location: "project",
  method: "project",
  prices: "units",
  "price-matrix": "units",
  recommendations: "units",
  compare: "units",
  payments: "units",
  "floor-profit": "investor",
  rental: "investor",
};

export function tabFromHash(hash: string): { tab: TabId; section: string | null } | null {
  const h = hash.replace(/^#/, "");
  if (!h) return null;
  const tab = TABS.find((t) => t.id === h);
  if (tab) return { tab: tab.id, section: null };
  if (SECTION_TAB[h]) return { tab: SECTION_TAB[h], section: h };
  return null;
}

/**
 * Every tab is always visible as a pill. Desktop: one row. Phone and tablet:
 * the same pills in a strip you can swipe, with the current tab scrolled
 * into view and a fade at the edge showing there are more.
 */
export function TabNav({ active, onChange, shortlistButton }: { active: TabId; onChange: (t: TabId) => void; shortlistButton?: React.ReactNode }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: true });

  const updateEdges = () => {
    const el = stripRef.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft > 4, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };

  // Keep the current tab in view (horizontally only, so the page doesn't jump).
  useEffect(() => {
    const el = stripRef.current;
    const pill = el?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (!el || !pill) return;
    el.scrollTo({ left: pill.offsetLeft - (el.clientWidth - pill.offsetWidth) / 2, behavior: "smooth" });
    const t = window.setTimeout(updateEdges, 350);
    return () => window.clearTimeout(t);
  }, [active]);

  const fade = `${edges.start ? "transparent, black 28px" : "black"}, ${edges.end ? "black calc(100% - 40px), transparent" : "black"}`;

  return (
    <nav aria-label="Project sections" className="sticky top-0 z-30 border-b border-canopy/10 bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 sm:px-6">
        {/* Phone and tablet */}
        <div
          ref={stripRef}
          onScroll={updateEdges}
          className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-2 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
          style={{ maskImage: `linear-gradient(to right, ${fade})`, WebkitMaskImage: `linear-gradient(to right, ${fade})` }}
        >
          {TABS.map((t, i) => {
            const on = t.id === active;
            return (
              <button
                key={t.id}
                data-tab={t.id}
                type="button"
                aria-current={on ? "page" : undefined}
                onClick={() => onChange(t.id)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 font-display-normal text-sm font-semibold ${
                  on ? "border-canopy bg-canopy text-mist" : "border-canopy/20 bg-paper text-canopy/80"
                }`}
              >
                <span aria-hidden="true" className={`text-xs ${on ? "text-mist/70" : "text-canopy/45"}`}>{i + 1}</span>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Desktop */}
        <div role="tablist" aria-label="Project sections" className="hidden min-w-0 flex-1 gap-1 py-2 lg:flex">
          {TABS.map((t, i) => {
            const on = t.id === active;
            return (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                role="tab"
                type="button"
                aria-selected={on}
                aria-controls={`panel-${t.id}`}
                tabIndex={on ? 0 : -1}
                onClick={() => onChange(t.id)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                  const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
                  onChange(next.id);
                  requestAnimationFrame(() => document.getElementById(`tab-${next.id}`)?.focus());
                }}
                className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 font-display-normal text-sm font-semibold transition-colors xl:px-4 ${
                  on ? "bg-canopy text-mist" : "text-canopy/75 hover:bg-mist-deep"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {shortlistButton}
      </div>
    </nav>
  );
}

/** Page title and one-line purpose at the top of every tab. */
export function TabIntro({ tab, children }: { tab: TabId; children?: React.ReactNode }) {
  const t = TABS.find((x) => x.id === tab)!;
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-[62ch]">
        <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{t.label}</h2>
        <p className="mt-2 text-[1.0625rem] text-canopy/80">{t.intro}</p>
      </div>
      {children}
    </div>
  );
}

/** Shown where a project has not supplied the information yet. Never filled with guesses. */
export function NotSupplied({
  title,
  children,
  needed,
}: {
  /** Plain statement, e.g. "Rental evidence has not been added for this project." */
  title: string;
  children?: React.ReactNode;
  /** What would fill this section, in plain words. */
  needed: string[];
}) {
  return (
    <div className={`${card} border-dashed p-5 sm:p-6`}>
      <p className="font-display-normal text-xs font-semibold uppercase tracking-[0.14em] text-[#8a5a14]">Not added yet</p>
      <h3 className="mt-1 font-display-normal text-lg font-semibold">{title}</h3>
      {children && <div className="mt-2 max-w-[72ch] text-[1rem] text-canopy/80">{children}</div>}
      <details className="mt-3">
        <summary className="cursor-pointer font-display-normal text-sm font-semibold text-reservoir">What&apos;s needed to add it</summary>
        <ul className="mt-2 grid list-disc gap-1 pl-5 text-[0.9375rem] text-canopy/80">
          {needed.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/** Previous and next section at the foot of every tab, so the order is easy to follow. */
export function SectionPager({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const i = TABS.findIndex((t) => t.id === active);
  const prev = TABS[i - 1];
  const next = TABS[i + 1];
  const base = "flex min-w-0 flex-1 flex-col rounded-xl border border-canopy/15 bg-paper px-4 py-3 font-display-normal hover:bg-mist-deep";
  return (
    <nav aria-label="Previous and next section" className="mt-12 flex gap-3">
      {prev ? (
        <button type="button" onClick={() => onChange(prev.id)} className={`${base} items-start text-left`}>
          <span className="text-xs text-canopy/60">← Previous</span>
          <span className="truncate text-sm font-semibold">{prev.label}</span>
        </button>
      ) : (
        <span className="flex-1" />
      )}
      {next ? (
        <button type="button" onClick={() => onChange(next.id)} className={`${base} items-end text-right`}>
          <span className="text-xs text-canopy/60">Next section {i + 2} of {TABS.length} →</span>
          <span className="max-w-full truncate text-sm font-semibold">{next.label}</span>
        </button>
      ) : (
        <span className="flex-1" />
      )}
    </nav>
  );
}

