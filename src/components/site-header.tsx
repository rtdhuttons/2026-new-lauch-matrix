import { site } from "@/content/site";

interface NavItem {
  href: string;
  label: string;
}

const homeNav: NavItem[] = [
  { href: "#site-plan", label: "Site plan" },
  { href: "#units", label: "Units" },
  { href: "#location", label: "Location" },
];

export function SiteHeader({
  nav = homeNav,
  cta = { href: "#register", label: "Register for preview" },
  homeHref = "#top",
}: {
  nav?: NavItem[];
  cta?: NavItem | null;
  homeHref?: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-canopy/10 bg-mist/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-8">
        <a href={homeHref} className="flex items-baseline gap-2.5">
          <span className="font-display text-xl font-extrabold tracking-tight">
            {site.brand}
          </span>
          <span className="hidden font-serif text-sm italic text-stone sm:inline">
            {site.brandFull}
          </span>
        </a>
        <nav aria-label="Sections" className="flex items-center gap-1 sm:gap-6">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="hidden font-display-normal text-sm font-medium text-canopy/80 hover:text-canopy md:inline"
            >
              {item.label}
            </a>
          ))}
          {cta && (
            <a
              href={cta.href}
              className="rounded-full bg-canopy px-4 py-2 font-display-normal text-sm font-semibold text-mist hover:bg-canopy-soft"
            >
              {cta.label}
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
