import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { featuredProjects, liveProjects } from "@/features/selector/data/projects";

export default function Home() {
  return (
    <>
      <SiteHeader nav={featuredProjects.map((p) => ({ href: `/projects/${p.id}`, label: p.name }))} cta={null} />
      <main id="top" className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-8">
        <h1 className="font-display text-[2.75rem] font-extrabold leading-none tracking-tight sm:text-[5rem]">
          TRM
        </h1>
        <p className="mt-3 font-serif text-xl italic text-stone">The Realty Master</p>
        <p className="mt-8 max-w-[58ch] text-lg leading-relaxed">
          Tools that help buyers choose the right new-launch home: which stack, which floor, and whether the premium for a better view is worth paying.
        </p>

        <Link href="/map" className="mt-8 inline-block rounded-full bg-canopy px-6 py-3 font-display-normal text-[0.9375rem] font-semibold text-mist hover:bg-canopy/90">
          See every new launch on the map
        </Link>

        {featuredProjects.map((p, i) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="group relative mt-10 block overflow-hidden rounded-2xl bg-canopy text-white"
          >
            <div className="relative aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9]">
              {p.card.image && (
                <Image
                  src={p.card.image.src}
                  alt={p.card.image.alt}
                  fill
                  sizes="(min-width: 1280px) 1216px, 100vw"
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : "auto"}
                  className="object-cover object-[50%_60%] transition-transform duration-700 ease-out group-hover:scale-[1.02] motion-reduce:transition-none"
                />
              )}
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#0b1d14]/90 via-[#0b1d14]/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
                <p className="font-display-normal text-sm font-semibold uppercase tracking-[0.18em] text-white/85">{p.card.eyebrow}</p>
                <p className="mt-2 font-display text-4xl font-extrabold leading-none tracking-tight sm:text-6xl">{p.name}</p>
                <p className="mt-3 max-w-[52ch] text-base text-white/90 sm:text-lg">{p.card.summary}</p>
                <span className="mt-5 inline-block rounded-full bg-white px-5 py-2.5 font-display-normal text-sm font-semibold text-canopy group-hover:bg-mist">
                  Explore {p.name}
                </span>
              </div>
              {p.card.image && <span className="absolute right-3 top-3 font-display-normal text-xs text-white/75">Artist&apos;s impression</span>}
            </div>
          </Link>
        ))}

        <section aria-labelledby="all-projects" className="mt-16">
          <h2 id="all-projects" className="font-display text-3xl font-extrabold tracking-tight">Every project on the map</h2>
          <p className="mt-2 max-w-[62ch] text-canopy/80">
            Each has its own guide with the same tabs: every unit, floor plans, prices where released, schools, nearby projects and a payment estimate.
          </p>
          <ul className="mt-6 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {liveProjects
              .filter((p) => !p.featured)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => (
                <li key={p.id} className="min-w-0">
                  <Link href={`/projects/${p.id}`} className="flex items-baseline justify-between gap-3 border-b border-canopy/10 py-2 hover:text-reservoir">
                    <span className="truncate font-display-normal font-semibold">{p.name}</span>
                    <span className="shrink-0 font-display-normal text-sm text-stone">{p.card.eyebrow.split(" · ").pop()}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
