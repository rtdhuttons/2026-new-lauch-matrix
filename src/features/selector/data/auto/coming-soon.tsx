"use client";

import Link from "next/link";
import { AlternativesTab } from "../../components/alternatives-tab";
import { ProjectHero } from "../../components/project-hero";
import { card, NumbersDisclaimer } from "../../components/ui";
import type { ProjectBundle } from "../../model/project";
import type { AutoSpec } from "./build";

const km = (m: number) => (m < 1000 ? `${m.toLocaleString("en-SG")} m` : `${(m / 1000).toFixed(1)} km`);

/** A project whose units aren't released yet: what is known now, and what comes at launch. */
export function ComingSoon({ spec, project }: { spec: AutoSpec; project: ProjectBundle }) {
  const f = spec.facts;
  const station = spec.mrt[0];
  const facts: [string, string | null][] = [
    ["Address", project.profile.address],
    ["District", project.profile.district],
    ["Market segment", f.segment],
    ["Developer", f.developer],
    ["Tenure", f.tenure],
    ["Units", f.totalUnits ? f.totalUnits.toLocaleString("en-SG") : null],
    ["Site area", f.siteArea],
    ["Expected launch", f.launchDate ? (f.launchDate > spec.fetched ? f.launchDate : `${f.launchDate} (per the API; units not listed yet)`) : f.launchNote],
    ["Expected completion", f.completionDate ?? f.completionNote],
  ];
  const heroFacts = [
    ...(f.totalUnits ? [{ label: "Units", value: f.totalUnits.toLocaleString("en-SG") }] : []),
    ...(f.tenure ? [{ label: "Tenure", value: f.tenure }] : []),
    ...(f.launchDate ? [{ label: "Expected launch", value: f.launchDate }] : []),
    ...(station ? [{ label: `${station.name} MRT`, value: station.minutes ? `About ${station.minutes} min walk` : km(station.metres) }] : []),
  ];
  return (
    <>
      {project.media.hero ? (
        <ProjectHero image={project.media.hero} name={project.profile.name} eyebrow={project.copy.eyebrow} facts={heroFacts} />
      ) : (
        <section className="bg-canopy px-4 pb-10 pt-20 text-white sm:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="font-display-normal text-sm font-semibold uppercase tracking-[0.18em] text-white/85">{project.copy.eyebrow}</p>
            <h1 className="mt-2 font-display text-[3rem] font-extrabold leading-[0.95] tracking-tight sm:text-[5rem]">{project.profile.name}</h1>
          </div>
        </section>
      )}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
        <p className="rounded-xl border-l-4 border-[#c88a12] bg-[#fbf5e8] px-4 py-3 font-display-normal">
          <span className="font-semibold">Units not released yet.</span> The developer hasn&apos;t listed this project&apos;s units, floor plans or prices. Its full guide (every stack and floor, floor plans, prices and payments) appears here once they are.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          <section className={`${card} p-5`} aria-labelledby="facts">
            <h2 id="facts" className="font-display text-[22px] font-extrabold leading-tight">Project facts</h2>
            <dl className="mt-3 grid gap-2 font-display-normal text-[15px]">
              {facts.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-canopy/10 pb-2">
                  <dt className="text-canopy/70">{k}</dt>
                  <dd className="text-right font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm text-stone">Source: Huttons New Launch API, {spec.fetched}.</p>
          </section>

          <section className={`${card} p-5`} aria-labelledby="around">
            <h2 id="around" className="font-display text-[22px] font-extrabold leading-tight">Getting around and schools</h2>
            {spec.mrt.length > 0 && (
              <ul className="mt-3 grid gap-1 font-display-normal text-[15px]">
                {spec.mrt.map((m) => (
                  <li key={m.name}>
                    {m.name} MRT: {km(m.metres)} walk{m.minutes ? `, about ${m.minutes} min` : ""}
                  </li>
                ))}
              </ul>
            )}
            {spec.schools.length > 0 && (
              <>
                <h3 className="mt-4 font-display-normal font-semibold">Primary schools within 2.5 km</h3>
                <ul className="mt-1 grid gap-1 font-display-normal text-[15px]">
                  {spec.schools.map((s) => (
                    <li key={s.name} className="flex justify-between gap-4">
                      <span>{s.name}</span>
                      <span className="tabular-nums text-canopy/75">{km(s.metres)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm text-stone">Straight line on OneMap from the project&apos;s map position to each school&apos;s address point. MOE measures from your address to the school boundary.</p>
              </>
            )}
          </section>
        </div>

        {project.alternatives.length > 0 && (
          <section className="mt-10" aria-labelledby="nearby">
            <h2 id="nearby" className="font-display text-[22px] font-extrabold leading-tight">Nearby projects to compare</h2>
            <p className="mt-1 mb-5 text-[0.9375rem] text-canopy/75">What the nearest projects on the map are selling now, while this project&apos;s prices are not released.</p>
            <AlternativesTab alternatives={project.alternatives} projectName={project.profile.name} ownTypes={[]} selected={null} ownPriceNote={null} />
          </section>
        )}

        {project.location && (
          <section className="mt-8" aria-labelledby="loc">
            <h2 id="loc" className="font-display text-[22px] font-extrabold leading-tight">Places nearby</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {project.location.groups.map((g) => (
                <div key={g.title} className={`${card} p-4`}>
                  <h3 className="font-display-normal font-semibold">{g.title}</h3>
                  <ul className="mt-1 list-disc pl-5 text-[15px]">
                    {g.items.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-2 text-sm text-stone">As the developer lists them.</p>
          </section>
        )}

        <NumbersDisclaimer className="mt-10" />
        <p className="mt-6">
          <Link href="/map" className="font-display-normal font-semibold text-reservoir underline underline-offset-4">
            See every new launch on the map
          </Link>
        </p>
      </div>
    </>
  );
}
