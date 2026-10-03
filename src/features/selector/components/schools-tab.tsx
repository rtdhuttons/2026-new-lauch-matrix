"use client";

// Schools: primary schools grouped by distance from the project (within
// 1 km, 1–2 km, not measured yet), kept apart from registration eligibility
// and past competition. Nothing here turns a distance or a past count into
// a chance of admission.

import type { School, SchoolsInfo } from "../model/project";
import { NotSupplied } from "./tabs";
import { card, Disclosure } from "./ui";

const LEVEL: Record<string, string> = { primary: "Primary", secondary: "Secondary", "junior-college": "Junior college" };

const GROUPS: { id: "within-1km" | "1-2km" | "outside-2km" | "unmeasured"; title: string; hint: string }[] = [
  { id: "within-1km", title: "Within 1 km", hint: "Highest priority group if a registration phase is balloted" },
  { id: "1-2km", title: "Between 1 and 2 km", hint: "Next priority group if a phase is balloted" },
  { id: "outside-2km", title: "Outside 2 km", hint: "" },
  { id: "unmeasured", title: "Not measured yet", hint: "Needs the official OneMap check" },
];

function distanceText(s: School): string | null {
  if (!s.distance || s.distance.byAddress.length === 0) return null;
  const m = s.distance.byAddress.map((a) => a.metres);
  const lo = Math.min(...m);
  const hi = Math.max(...m);
  return lo === hi ? `about ${lo.toLocaleString("en-SG")} m` : `about ${lo.toLocaleString("en-SG")}–${hi.toLocaleString("en-SG")} m`;
}

function BasisTag({ basis }: { basis: "official" | "indicative" }) {
  return basis === "official" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-canopy px-2 py-0.5 font-display-normal text-xs font-semibold text-mist">✓ Official</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#c9a45a] bg-[#fbf3df] px-2 py-0.5 font-display-normal text-xs font-semibold text-[#7a5410]">≈ Indicative</span>
  );
}

function SchoolCard({ s }: { s: School }) {
  const d = distanceText(s);
  return (
    <li className={`${card} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-display-normal text-base font-semibold">
          {s.name}
          {s.highlighted && <span className="ml-2 align-middle text-xs font-semibold text-[#8a5a14]">★ TRM highlight</span>}
        </p>
        {s.distanceCategory && <BasisTag basis={s.distanceCategory.basis} />}
      </div>
      <p className="mt-0.5 text-sm text-canopy/75">
        {s.levels.map((l) => LEVEL[l]).join(" and ")}
        {d ? ` · ${d} from the project` : ""}
      </p>
      {s.note && <p className="mt-1 text-xs text-stone">{s.note}</p>}
      {s.distance && s.distance.byAddress.length > 1 && (
        <details className="mt-2">
          <summary className="cursor-pointer font-display-normal text-sm font-semibold text-reservoir">Distance from each block</summary>
          <ul className="mt-1.5 grid gap-0.5 font-display-normal text-sm tabular-nums">
            {s.distance.byAddress.map((a) => (
              <li key={a.address} className="flex justify-between gap-3">
                <span className="text-canopy/75">{a.address}</span>
                <span>{a.metres.toLocaleString("en-SG")} m</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-stone">
            Measured {s.distance.method}. {s.distance.provenance.note}
          </p>
        </details>
      )}
      {s.p1History.length > 0 && <p className="mt-2 text-sm">{s.p1History.length} years of Primary 1 registration results.</p>}
    </li>
  );
}

export function SchoolsTab({ schools, projectName, map }: { schools: SchoolsInfo | null; projectName: string; map: React.ReactNode }) {
  if (!schools || schools.schools.length === 0) {
    return <NotSupplied title={`Nearby schools have not been added for ${projectName}.`} needed={["The schools to show for this project, with their levels."]} />;
  }
  const primary = schools.schools.filter((s) => s.levels.includes("primary"));
  const others = schools.schools.filter((s) => !s.levels.includes("primary"));
  const groupOf = (s: School) => s.distanceCategory?.value ?? "unmeasured";
  const anyIndicative = primary.some((s) => s.distanceCategory?.basis === "indicative");

  return (
    <div className="grid grid-cols-1 gap-8 [&>*]:min-w-0">
      <div className="rounded-2xl border-l-4 border-[#b3532e] bg-paper p-5 shadow-sm sm:p-6">
        <h3 className="font-display-normal text-lg font-semibold">Living near a school does not guarantee a place</h3>
        <p className="mt-2 max-w-[72ch] text-[1rem] leading-relaxed text-canopy/85">
          For Primary 1 registration, homes within 1 km of a school, then between 1 and 2 km, get priority only when a registration phase has more
          applicants than places and goes to a ballot. Which phase a child qualifies for depends on the year&apos;s rules and their citizenship, and past
          results don&apos;t predict a future year.
        </p>
        <p className="mt-2 text-sm text-stone">
          Check the Ministry of Education&apos;s guidance for your registration year, and the official home–school distance for your exact address on OneMap.
        </p>
      </div>

      <section aria-labelledby="primary-title">
        <h3 id="primary-title" className="font-display text-xl font-extrabold">Primary schools by distance</h3>
        <p className="mt-1 text-[0.9375rem] text-canopy/75">
          Measured from {schools.measuredFrom ?? "the project"}. Where a project has several addresses, distances can differ by block.
        </p>
        <div className="mt-4 grid gap-6">
          {GROUPS.map((g) => {
            const list = primary.filter((s) => groupOf(s) === g.id);
            if (list.length === 0 && g.id !== "within-1km" && g.id !== "1-2km") return null;
            return (
              <div key={g.id}>
                <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
                  <h4 className="font-display-normal text-base font-semibold">{g.title}</h4>
                  {g.hint && <span className="text-sm text-canopy/65">{g.hint}</span>}
                </div>
                {list.length > 0 ? (
                  <ul className="grid gap-3 md:grid-cols-2">
                    {list.map((s) => (
                      <SchoolCard key={s.name} s={s} />
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-lg border border-dashed border-canopy/25 px-4 py-3 text-sm text-canopy/75">
                    No primary school measured in this group yet.
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {anyIndicative && (
          <p className="mt-4 text-sm text-stone">
            ≈ Indicative: worked out from map data, not the official OneMap check. It can differ, especially near 1 km or 2 km.
          </p>
        )}
      </section>

      {others.length > 0 && (
        <Disclosure title="Secondary schools and junior colleges nearby" hint="Home–school distance groups apply to Primary 1 registration">
          <ul className="grid gap-3 md:grid-cols-2">
            {others.map((s) => (
              <SchoolCard key={s.name} s={s} />
            ))}
          </ul>
        </Disclosure>
      )}

      {map}

      <p className="text-xs text-stone">
        Source: {schools.provenance.source}, checked {schools.provenance.updated}. {schools.provenance.note}
      </p>

      <NotSupplied
        title="Official distances and past Primary 1 results have not been added yet."
        needed={[
          "The official home–school distance (SLA OneMap) for each block's address, for every primary school within 2 km.",
          "Distances for schools beyond the neighbourhood map data.",
          "Past Primary 1 registration results by phase (MOE): places, applicants and whether balloting took place.",
          "The registration year to apply, and any schools you want highlighted.",
        ]}
      >
        OneMap can&apos;t be reached from the build environment yet; once it can, every primary school within 2 km can be measured from each block.
      </NotSupplied>
    </div>
  );
}
