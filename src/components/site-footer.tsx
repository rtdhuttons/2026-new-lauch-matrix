import { site } from "@/content/site";

function Detail({ term, value }: { term: string; value: string | null }) {
  return (
    <div>
      <dt className="text-stone">{term}</dt>
      <dd className={value ? "" : "italic text-stone"}>{value ?? "To be added"}</dd>
    </div>
  );
}

const DEFAULT_DISCLAIMER =
  "TRM is a property agency marketing Thomson Reserve. This is not the developer's website. Unit sizes, counts and dates are indicative and may change; the developer's sales brochure, price list and sale and purchase agreement take precedence.";

export function SiteFooter({ disclaimer = DEFAULT_DISCLAIMER }: { disclaimer?: string }) {
  return (
    <footer className="border-t border-canopy/10 bg-mist">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-8 md:grid-cols-[1fr_2fr]">
        <div>
          <p className="font-display text-2xl font-extrabold">{site.brand}</p>
          <p className="font-serif italic text-stone">{site.brandFull}</p>
        </div>
        <div className="grid gap-8">
          <dl className="grid gap-4 font-display-normal text-sm sm:grid-cols-3">
            <Detail term="Agent" value={site.agentName} />
            <Detail term="CEA registration" value={site.ceaRegistration} />
            <Detail term="Agency licence" value={site.agencyLicence} />
          </dl>
          <p className="max-w-[72ch] text-sm text-stone">{disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
