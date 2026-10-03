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
  { id: "upgrading", label: "My Upgrading Plan", intro: "Work out how selling your current home could support your next purchase." },
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
 * Desktop: all seven tabs in a row. Phone: a menu button that names the
 * current tab and opens the full list, so no label is cut short.
 */
export function TabNav({ active, onChange, shortlistButton }: { active: TabId; onChange: (t: TabId) => void; shortlistButton?: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = TABS.find((t) => t.id === active)!;
  const index = TABS.indexOf(current);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  return (
    <nav aria-label="Project sections" className="sticky top-0 z-30 border-b border-canopy/10 bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 sm:px-6">
        {/* Phone */}
        <div ref={menuRef} className="relative min-w-0 flex-1 py-2 lg:hidden">
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="section-menu"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-2 rounded-full border border-canopy/20 bg-paper px-4 py-2 text-left font-display-normal text-sm"
          >
            <span className="min-w-0 truncate">
              <span className="text-canopy/65">
                <span className="sm:hidden">{index + 1}/{TABS.length} </span>
                <span className="hidden sm:inline">Section {index + 1} of {TABS.length}: </span>
              </span>
              <span className="font-semibold">{current.label}</span>
            </span>
            <span aria-hidden="true" className={`transition-transform ${menuOpen ? "rotate-180" : ""}`}>▾</span>
          </button>
          {menuOpen && (
            <ul id="section-menu" className="absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded-2xl border border-canopy/15 bg-paper shadow-lg">
              {TABS.map((t, i) => (
                <li key={t.id}>
                  <button
                    type="button"
                    aria-current={t.id === active ? "page" : undefined}
                    onClick={() => {
                      setMenuOpen(false);
                      onChange(t.id);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left font-display-normal text-[0.9375rem] ${t.id === active ? "bg-mist font-semibold" : ""}`}
                  >
                    <span aria-hidden="true" className="w-4 text-canopy/50">{i + 1}</span>
                    {t.label}
                    {t.id === active && <span className="ml-auto text-xs text-canopy/60">Current</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
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
