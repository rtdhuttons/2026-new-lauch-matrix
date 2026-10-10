// The list of projects on the website. Adding a project: write its bundle
// and a three-line entry.tsx in its own data folder, then add one line here
// (see docs/adding-a-project.md). Only light details live here, so a page
// loads just the one project it shows.

import { createElement, type ComponentType } from "react";
import type { AutoSpec, AutoTrace } from "./auto/build";
import { autoListings, autoSpecLoaders, autoTraceLoaders } from "./auto/registry";
import { comparableRentLoaders, comparableRentsFor, type ComparableLeases } from "./comparables/rents";

export interface ProjectListing {
  id: string;
  name: string;
  /** "live" projects are listed and published; "sample" ones never are. */
  status: "live" | "sample";
  /** Shown on the home page and in the header; the rest are reached from the map. */
  featured?: boolean;
  card: {
    eyebrow: string;
    summary: string;
    image: { src: string; alt: string } | null;
  };
  /** Loads the project's page (main content and footer) on demand. */
  load: () => Promise<{ default: ComponentType }>;
  description: string;
}

export const projects: ProjectListing[] = [
  {
    id: "thomson-reserve",
    name: "Thomson Reserve",
    status: "live",
    featured: true,
    card: {
      eyebrow: "Now previewing · Bright Hill Drive",
      summary:
        "1,268 homes in six towers beside Upper Thomson MRT. Explore every stack and floor in 3D, with floor plans, sun, views and illustrative prices from level 1 to 30.",
      image: { src: "/thomson-reserve/images/hero-1920.jpg", alt: "Thomson Reserve's towers above a green landscape at dusk. Artist's impression." },
    },
    load: () => import("./thomson-reserve/entry"),
    description:
      "Explore Thomson Reserve stack by stack: the site plan in 3D, floor plans, illustrative prices, schools, resale and rental evidence, and the PIVOT assessment.",
  },
  {
    id: "the-serra-residences",
    name: "The Serra Residences",
    status: "live",
    featured: true,
    card: {
      eyebrow: "Launching 17 Oct · Bassein Road, Novena",
      summary:
        "133 freehold homes in one 28-storey tower near Novena MRT. Every stack and floor in 3D, with floor plans, sun and illustrative prices from level 4 to the penthouses.",
      image: { src: "/the-serra-residences/images/tower-1051.jpg", alt: "The Serra Residences tower above its landscaped podium. Artist's impression." },
    },
    load: () => import("./the-serra-residences/entry"),
    description:
      "Explore The Serra Residences stack by stack: the tower in 3D, floor plans, illustrative prices, schools and the payment estimate.",
  },
  {
    id: "sample-wrenfield",
    name: "Wrenfield Residences (sample)",
    status: "sample",
    card: { eyebrow: "Sample project", summary: "Fictional sample project for testing the template.", image: null },
    load: () => import("./demo/entry"),
    description: "Fictional sample project for testing the TRM website template.",
  },
];

// Every other project on the new launches map, built automatically from the
// Huttons New Launch API (scripts/huttons/build-sites.py, data/auto/).
for (const a of autoListings) {
  projects.push({
    id: a.id,
    name: a.name,
    status: "live",
    card: {
      eyebrow: [a.area, a.district].filter(Boolean).join(" · "),
      summary: a.summary,
      image: a.image ? { src: a.image, alt: `${a.name}. Artist's impression.` } : null,
    },
    load: async () => {
      const rentKey = comparableRentsFor[a.id];
      const [{ AutoProjectEntry }, spec, trace, rents] = await Promise.all([
        import("./auto/entry"),
        autoSpecLoaders[a.id](),
        autoTraceLoaders[a.id]?.() ?? Promise.resolve(null),
        (rentKey && comparableRentLoaders[rentKey]?.()) || Promise.resolve(null),
      ]);
      const props = {
        spec: spec.default as AutoSpec,
        trace: (trace?.default ?? null) as AutoTrace | null,
        // The chosen comparable's URA rental contracts, for the Investor tab's rent estimate.
        rents: (rents?.default ?? null) as ComparableLeases | null,
      };
      return { default: () => createElement(AutoProjectEntry, props) };
    },
    description: `Explore ${a.name} unit by unit: every stack and floor, floor plans, prices, schools, nearby projects and the payment estimate.`,
  });
}

export const liveProjects = projects.filter((p) => p.status === "live");
export const featuredProjects = liveProjects.filter((p) => p.featured);
export const findProject = (id: string) => projects.find((p) => p.id === id);
