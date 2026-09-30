import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <>
      <SiteHeader nav={[{ href: "/selector", label: "Stack & Unit Selector" }]} cta={null} />
      <main id="top" className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-8">
        <h1 className="font-display text-[2.75rem] font-extrabold leading-none tracking-tight sm:text-[5rem]">
          TRM
        </h1>
        <p className="mt-3 font-serif text-xl italic text-stone">The Realty Master</p>
        <p className="mt-8 max-w-[58ch] text-lg leading-relaxed">
          Tools that help buyers choose the right new-launch home: which stack, which floor, and whether the premium for a better view is worth paying.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Link
            href="/selector"
            className="group rounded-xl border border-canopy/10 bg-paper p-6 hover:border-canopy/40"
          >
            <p className="font-display text-xl font-extrabold group-hover:underline">Stack &amp; Unit Selector</p>
            <p className="mt-2 text-canopy/80">
              Compare floors and stacks by price premium, sun, view clearance, noise, MRT access and resale competition. Prototype with illustrative demo data.
            </p>
          </Link>
          <div className="rounded-xl border border-dashed border-canopy/25 p-6">
            <p className="font-display text-xl font-extrabold">Thomson Reserve</p>
            <p className="mt-2 text-canopy/80">
              Project page in progress. Site plan and unit breakdown will follow once the developer factsheet is confirmed.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
