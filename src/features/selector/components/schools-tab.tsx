"use client";

// Schools: what is known about nearby schools, kept apart into proximity,
// registration eligibility and past competition. Nothing here turns a
// distance or a past count into a chance of admission.

import type { SchoolsInfo } from "../model/project";
import { NotSupplied } from "./tabs";
import { card } from "./ui";

const LEVEL: Record<string, string> = { primary: "Primary", secondary: "Secondary", "junior-college": "Junior college" };
const CATEGORY: Record<string, string> = { "within-1km": "Within 1 km", "1-2km": "Between 1 and 2 km", "outside-2km": "Outside 2 km" };

export function SchoolsTab({ schools, projectName, map }: { schools: SchoolsInfo | null; projectName: string; map: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-8 [&>*]:min-w-0">

      <div className="rounded-2xl border-l-4 border-[#b3532e] bg-paper p-5 shadow-sm sm:p-6">
        <h3 className="font-serif text-lg font-semibold">Living near a school does not guarantee a place</h3>
        <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-[1rem] leading-relaxed text-canopy/85">
          <li><strong>Proximity</strong> is the distance from the home&apos;s address to the school, as measured by the official method for Primary 1 registration.</li>
          <li><strong>Eligibility</strong> depends on the registration year&apos;s rules, the child&apos;s citizenship and the phase the family qualifies for.</li>
          <li><strong>Competition</strong> is how many applied against the places available in each phase in past years. Past results don&apos;t predict a future year.</li>
        </ul>
        <p className="mt-3 text-sm text-stone">Always check the Ministry of Education&apos;s guidance for the registration year you are applying in.</p>
      </div>

      {schools && schools.schools.length > 0 ? (
        <div className={`${card} overflow-hidden p-0`}>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse font-display-normal text-sm">
              <caption className="px-5 pb-2 pt-5 text-left">
                <span className="block font-display text-lg font-extrabold">Schools named near the site</span>
                <span className="block text-sm font-normal text-canopy/75">
                  Measured from: {schools.measuredFrom ?? "address not set"} · Registration year: {schools.registrationYear ?? "not set"}
                </span>
              </caption>
              <thead>
                <tr className="bg-canopy text-left text-xs uppercase tracking-[0.08em] text-mist">
                  <th scope="col" className="px-5 py-3 font-semibold">School</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Level</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Distance</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Distance category</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Past P1 registration</th>
                </tr>
              </thead>
              <tbody>
                {schools.schools.map((s) => (
                  <tr key={s.name} className="border-t border-canopy/10 align-top">
                    <th scope="row" className="px-5 py-2.5 text-left font-semibold">
                      {s.name}
                      {s.note && <span className="block text-xs font-normal text-stone">{s.note}</span>}
                    </th>
                    <td className="px-3 py-2.5">{s.levels.map((l) => LEVEL[l]).join(", ")}</td>
                    <td className="px-3 py-2.5 text-canopy/80">{s.distance ? `${s.distance.metres.toLocaleString("en-SG")} m (${s.distance.method})` : "Not measured"}</td>
                    <td className="px-3 py-2.5 text-canopy/80">{s.distanceCategory ? CATEGORY[s.distanceCategory] : "Not checked"}</td>
                    <td className="px-5 py-2.5 text-canopy/80">
                      {!s.levels.includes("primary") ? "Not applicable" : s.p1History.length > 0 ? `${s.p1History.length} records` : "Not supplied"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-canopy/10 px-5 py-3 text-xs text-stone">
            Source: {schools.provenance.source}, checked {schools.provenance.updated}. {schools.provenance.note}
          </p>
        </div>
      ) : (
        <NotSupplied title={`Nearby schools have not been added for ${projectName}.`} needed={["The schools to show for this project, with their levels."]} />
      )}

      {map}

      <NotSupplied
        title="School distances and past Primary 1 results have not been added yet."
        needed={[
          "The schools you want highlighted.",
          "Official home-school distance for the project address (SLA OneMap school query) for each primary school.",
          "Past Primary 1 registration results by phase (MOE): places, applicants and whether balloting took place, for recent years.",
          "The registration year to apply, and the MOE guidance for that year.",
          "Any school-distance or registration material you already have.",
        ]}
      >
        Until these are supplied, distances and categories stay blank rather than estimated.
      </NotSupplied>
    </div>
  );
}
