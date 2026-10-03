import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { findProject, projects } from "@/features/selector/data/projects";

// Every project, live or sample, gets a page; sample pages are never indexed
// or linked from the home page.
export const dynamicParams = false;

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = findProject(slug);
  if (!p) return {};
  return {
    title: `${p.name} | TRM — The Realty Master`,
    description: p.description,
    robots: p.status === "sample" ? { index: false, follow: false } : undefined,
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = findProject(slug);
  if (!p) notFound();
  const { default: Entry } = await p.load();
  return (
    <>
      <SiteHeader homeHref="/" nav={[]} cta={null} sticky={false} />
      <Entry />
    </>
  );
}
