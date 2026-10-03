// Standalone entry for publishing one project's website as a single HTML
// page. "@trm/project-entry" is set by scripts/build-artifact.mjs to the
// chosen project's entry.tsx, so no other project's data is bundled.
import { createRoot } from "react-dom/client";
import { SiteHeader } from "@/components/site-header";
import ProjectEntry from "@trm/project-entry";

function Page() {
  return (
    <>
      <SiteHeader homeHref="#top" nav={[]} cta={null} sticky={false} />
      <ProjectEntry />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Page />);
