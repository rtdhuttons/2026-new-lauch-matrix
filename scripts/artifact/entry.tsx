// Standalone entry for publishing the selector as a single HTML page.
import { createRoot } from "react-dom/client";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SelectorApp } from "@/features/selector/components/selector-app";

function Page() {
  return (
    <>
      <SiteHeader
        homeHref="#top"
        nav={[
          { href: "#explore", label: "Explore" },
          { href: "#recommendations", label: "Recommendations" },
          { href: "#scenario", label: "Scenarios" },
          { href: "#method", label: "Method" },
        ]}
        cta={{ href: "#compare", label: "Compare" }}
      />
      <main id="top">
        <SelectorApp />
      </main>
      <SiteFooter disclaimer="This selector is a prototype built with illustrative demo data for a fictional project. It is not advice and does not describe any real development. Always check the developer's brochure, price list and sale and purchase agreement." />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Page />);
