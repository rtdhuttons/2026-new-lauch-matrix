"use client";

import ProjectsMapEntry from "./entry";

// Published guides, linked from the map in the single-page build.
const LINKS: Record<string, string> = {
  "Thomson Reserve": "https://claude.ai/artifact/5kRAW7usFiDUPDepbFZjSP",
  "The Serra Residences": "https://claude.ai/artifact/4Ym1GFYpmJDWMDQkwmnSyf",
};

export default function ProjectsMapArtifact() {
  return <ProjectsMapEntry links={LINKS} />;
}
