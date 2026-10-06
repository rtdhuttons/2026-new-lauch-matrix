import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import ProjectsMapEntry from "@/features/catalogue/entry";
import { linkKey } from "@/features/catalogue/lib";
import { liveProjects } from "@/features/selector/data/projects";

export const metadata: Metadata = {
  title: "New launches map | TRM — The Realty Master",
  description: "Every Huttons new launch on one map, with unit types and prices, nearby projects to compare, and nearby sales, rents and growth.",
};

export default function MapPage() {
  return (
    <>
      <SiteHeader homeHref="/" nav={[]} cta={null} sticky={false} />
      <ProjectsMapEntry links={Object.fromEntries(liveProjects.map((p) => [linkKey(p.name), `/projects/${p.id}`]))} />
    </>
  );
}
