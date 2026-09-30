import { site } from "@/content/site";

const DEFAULT_DISCLAIMER =
  "TRM is a property agency marketing Thomson Reserve. This is not the developer's website. Unit sizes, counts and dates are indicative and may change; the developer's sales brochure, price list and sale and purchase agreement take precedence.";

export function SiteFooter({ disclaimer = DEFAULT_DISCLAIMER }: { disclaimer?: string }) {
  const details = [
    { term: "Huttons Associate", value: site.agentName },
    { term: "CEA registration", value: site.ceaRegistration },
    { term: "Phone / WhatsApp", value: site.phone },
    { term: "Email", value: site.email },
    { term: "Agency", value: site.agencyLicence ? `${site.agency} (licence ${site.agencyLicence})` : site.agency },
  ].filter((d): d is { term: string; value: string } => Boolean(d.value));

  return (
    <footer className="border-t border-canopy/10 bg-mist">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-8 md:grid-cols-[1fr_2fr]">
        <div>
          <p className="font-display text-2xl font-extrabold">{site.brand}</p>
          <p className="font-serif italic text-stone">{site.brandFull}</p>
        </div>
        <div className="grid gap-8">
          <section aria-labelledby="footer-contact">
            <h2 id="footer-contact" className="font-display text-xl font-extrabold">
              Contact a Huttons Associate
            </h2>
            <p className="mt-2 max-w-[60ch] text-[1rem] leading-relaxed text-canopy/85">
              For the e-brochure, the latest price list and availability, or to book a show flat viewing, speak to a Huttons Associate.
            </p>
            <dl className="mt-4 grid gap-4 font-display-normal text-sm sm:grid-cols-3">
              {details.map((d) => (
                <div key={d.term}>
                  <dt className="text-stone">{d.term}</dt>
                  <dd className="select-all font-semibold">{d.value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <p className="max-w-[72ch] text-sm text-stone">{disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
