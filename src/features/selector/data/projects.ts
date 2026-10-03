// The list of projects on the website. Adding a project: write its bundle
// and a three-line entry.tsx in its own data folder, then add one line here
// (see docs/adding-a-project.md). Only light details live here, so a page
// loads just the one project it shows.

import type { ComponentType } from "react";

export interface ProjectListing {
  id: string;
  name: string;
  /** "live" projects are listed and published; "sample" ones never are. */
  status: "live" | "sample";
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
    id: "sample-wrenfield",
    name: "Wrenfield Residences (sample)",
    status: "sample",
    card: { eyebrow: "Sample project", summary: "Fictional sample project for testing the template.", image: null },
    load: () => import("./demo/entry"),
    description: "Fictional sample project for testing the TRM website template.",
  },
];

export const liveProjects = projects.filter((p) => p.status === "live");
export const findProject = (id: string) => projects.find((p) => p.id === id);
