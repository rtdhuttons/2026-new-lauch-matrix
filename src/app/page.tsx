import Image from "next/image";
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

        <Link
          href="/selector"
          className="group relative mt-10 block overflow-hidden rounded-2xl bg-canopy text-white"
        >
          <div className="relative aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9]">
            <Image
              src="/thomson-reserve/images/hero-1920.jpg"
              alt="Thomson Reserve's towers above a green landscape at dusk. Artist's impression."
              fill
              sizes="(min-width: 1280px) 1216px, 100vw"
              loading="eager"
              fetchPriority="high"
              className="object-cover object-[50%_60%] transition-transform duration-700 ease-out group-hover:scale-[1.02] motion-reduce:transition-none"
            />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#0b1d14]/90 via-[#0b1d14]/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
              <p className="font-display-normal text-sm font-semibold uppercase tracking-[0.18em] text-white/85">
                Now previewing · Bright Hill Drive
              </p>
              <p className="mt-2 font-display text-4xl font-extrabold leading-none tracking-tight sm:text-6xl">
                Thomson Reserve
              </p>
              <p className="mt-3 max-w-[52ch] text-base text-white/90 sm:text-lg">
                1,268 homes in six towers beside Upper Thomson MRT. Explore every stack and floor in 3D, with floor plans, sun, views and illustrative prices from level 1 to 30.
              </p>
              <span className="mt-5 inline-block rounded-full bg-white px-5 py-2.5 font-display-normal text-sm font-semibold text-canopy group-hover:bg-mist">
                Open the Stack &amp; Unit Selector
              </span>
            </div>
            <span className="absolute right-3 top-3 font-display-normal text-xs text-white/75">Artist&apos;s impression</span>
          </div>
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
