"use client";

import { SiteFooter } from "@/components/site-footer";
import { ProjectsMap } from "./components/projects-map";
import { catalogue, market, uraLoaded } from "./data";
import { linkKey } from "./lib";
import type { CatalogueProject } from "./model";

/**
 * The projects map's page. Projects with their own guide link to it: on the
 * website its page, in the single-page build the published guide. `links` is
 * keyed by linkKey(project name), so this page doesn't load every project's data.
 */
export default function ProjectsMapEntry({ links }: { links: Record<string, string> }) {
  const projectLink = (p: CatalogueProject) => links[linkKey(p.name)] ?? null;
  return (
    <>
      <main id="top">
        <ProjectsMap catalogue={catalogue} market={market} marketLoaded={uraLoaded} projectLink={projectLink} />
      </main>
      <SiteFooter disclaimer="Project details and prices from the Huttons New Launch API; sales and rents from URA's Data Service where loaded. Figures are estimates for general information, not advice or a developer's offer." />
    </>
  );
}
