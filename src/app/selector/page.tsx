import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SelectorApp } from "@/features/selector/components/selector-app";

export const metadata: Metadata = {
  title: "Thomson Reserve Stack & Unit Selector | TRM — The Realty Master",
  description:
    "Explore Thomson Reserve stack by stack: the site plan in 3D, sun and shadows, noise and privacy screening, and walking time to Upper Thomson MRT.",
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
      <SiteFooter disclaimer="This selector is a TRM prototype. Thomson Reserve's layout is traced from the developer's site plan, with unit types and floor plans from the developer's unit plans; prices and availability are not published yet, and nothing here is the developer's advice. Always check the developer's brochure, price list and sale and purchase agreement." />
    </>
  );
}
