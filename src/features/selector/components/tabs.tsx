"use client";

// The seven main tabs, in a fixed order for every project, and the shared
// "not supplied yet" card used wherever a project hasn't provided the data.

import { card } from "./ui";

export type TabId = "project" | "units" | "schools" | "investor" | "alternatives" | "pivot" | "upgrading";

export const TABS: { id: TabId; label: string; short: string }[] = [
  { id: "project", label: "Project & 3D Site", short: "Project & 3D" },
  { id: "units", label: "Units & Payments", short: "Units" },
  { id: "schools", label: "Schools", short: "Schools" },
  { id: "investor", label: "Investor", short: "Investor" },
  { id: "alternatives", label: "Alternative Projects", short: "Alternatives" },
  { id: "pivot", label: "PIVOT", short: "PIVOT" },
  { id: "upgrading", label: "My Upgrading Plan", short: "Upgrading" },
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

export function TabNav({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav aria-label="Project sections" className="sticky top-0 z-30 border-b border-canopy/10 bg-paper/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-2 sm:px-6">
        <div role="tablist" aria-label="Project sections" className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 font-display-normal text-sm font-semibold transition-colors sm:px-4 ${
                  on ? "bg-canopy text-mist" : "text-canopy/75 hover:bg-mist-deep"
                }`}
              >
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/** Shown where a project has not supplied the information yet. Never filled with guesses. */
export function NotSupplied({
  title,
  children,
  needed,
}: {
  title: string;
  children?: React.ReactNode;
  /** What would fill this section, in plain words. */
  needed: string[];
}) {
  return (
    <div className={`${card} border-dashed p-5 sm:p-6`}>
      <p className="font-display-normal text-xs font-semibold uppercase tracking-[0.14em] text-[#8a5a14]">Not supplied yet</p>
      <h3 className="mt-1 font-display text-lg font-extrabold">{title}</h3>
      {children && <div className="mt-2 max-w-[72ch] text-[1rem] text-canopy/80">{children}</div>}
      <p className="mt-3 font-display-normal text-sm font-semibold">What&apos;s needed</p>
      <ul className="mt-1 grid list-disc gap-1 pl-5 text-[0.9375rem] text-canopy/80">
        {needed.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}
