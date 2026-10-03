// Resolved at build time by scripts/build-artifact.mjs to the chosen
// project's entry.tsx.
declare module "@trm/project-entry" {
  const ProjectEntry: import("react").ComponentType;
  export default ProjectEntry;
}
