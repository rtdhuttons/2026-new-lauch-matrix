import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SelectorApp } from "@/features/selector/components/selector-app";

export const metadata: Metadata = {
  title: "Stack & Unit Selector (illustrative demo) | TRM — The Realty Master",
  description:
    "Compare stacks and floors by price premium, sun, view clearance, noise and privacy, MRT access and resale competition. Illustrative demo data.",
};

export default function SelectorPage() {
  return (
    <>
      <SiteHeader
        homeHref="/"
        nav={[
          { href: "#explore", label: "Explore" },
          { href: "#recommendations", label: "Recommendations" },
          { href: "#scenario", label: "Scenarios" },
          { href: "#method", label: "Method" },
        ]}
        cta={{ href: "#compare", label: "Compare" }}
      />
      <main>
        <SelectorApp />
      </main>
      <SiteFooter disclaimer="This selector is a prototype built with illustrative demo data for a fictional project. It is not advice and does not describe any real development. Always check the developer's brochure, price list and sale and purchase agreement." />
    </>
  );
}
