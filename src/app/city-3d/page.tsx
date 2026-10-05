import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { City3D } from "@/features/city3d/city-3d";
import { NumbersDisclaimer } from "@/features/selector/components/ui";

export const metadata: Metadata = {
  title: "Thomson Reserve in 3D | TRM — The Realty Master",
  description: "Thomson Reserve's towers in Google's 3D city, with the sun and shadows for any date and time.",
};

export default function City3DPage() {
  return (
    <>
      <SiteHeader homeHref="/" nav={[]} cta={null} sticky={false} />
      <main id="top" className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">Thomson Reserve in the city</h1>
        <p className="mt-3 max-w-[70ch] text-lg text-canopy/80">
          The six towers on their real site among the neighbourhood&apos;s buildings and trees. Choose a date and time to see the sun and shadows, and tap a
          tower to open its stack in the selector.
        </p>
        <div className="mt-6">
          <City3D
            placementUrl="/thomson-reserve/3d/placement.json"
            modelBase="/thomson-reserve/3d/"
            selectorHref="/projects/thomson-reserve"
            googleKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null}
          />
        </div>
        <NumbersDisclaimer className="mt-8" />
      </main>
      <SiteFooter />
    </>
  );
}
