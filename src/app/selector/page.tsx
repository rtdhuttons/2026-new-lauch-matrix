import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { findProject } from "@/features/selector/data/projects";
import ThomsonReserveEntry from "@/features/selector/data/thomson-reserve/entry";

const listing = findProject("thomson-reserve")!;

// The original address of the Thomson Reserve selector, kept so shared links still work.
export const metadata: Metadata = {
  title: `${listing.name} | TRM — The Realty Master`,
  description: listing.description,
};

export default function SelectorPage() {
  return (
    <>
      <SiteHeader homeHref="/" nav={[]} cta={null} sticky={false} />
      <ThomsonReserveEntry />
    </>
  );
}
