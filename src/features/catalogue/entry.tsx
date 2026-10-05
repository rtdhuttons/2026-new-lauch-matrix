"use client";

import { SiteFooter } from "@/components/site-footer";
import { liveProjects } from "@/features/selector/data/projects";
import { ProjectsMap } from "./components/projects-map";
import { catalogue, market, uraLoaded } from "./data";
import type { CatalogueProject } from "./model";

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The projects map's page. On the website, projects with their own guide
 * link to it; the single-page build passes links to the published guides.
 */
export default function ProjectsMapEntry({ links }: { links?: Record<string, string> }) {
  const projectLink = (p: CatalogueProject) => {
    if (links) return links[p.name] ?? null;
    const live = liveProjects.find((l) => key(l.name) === key(p.name));
    return live ? `/projects/${live.id}` : null;
  };
  return (
    <>
      <main id="top">
        <ProjectsMap catalogue={catalogue} market={market} marketLoaded={uraLoaded} projectLink={projectLink} />
      </main>
      <SiteFooter disclaimer="Project details and prices from the Huttons New Launch API; sales and rents from URA's Data Service where loaded. Figures are estimates for general information, not advice or a developer's offer." />
    </>
  );
}
