// Resolved at build time by scripts/build-artifact.mjs to the chosen
// project's entry.tsx.
declare module "@trm/project-entry" {
  const ProjectEntry: import("react").ComponentType;
  export default ProjectEntry;
}

// An automatically built project's data files, for scripts/artifact/auto-entry.tsx.
declare module "@trm/auto-spec" {
  const spec: unknown;
  export default spec;
}
declare module "@trm/auto-rents" {
  const rents: unknown;
  export default rents;
}
declare module "@trm/auto-trace" {
  const trace: unknown;
  export default trace;
}
