"use client";

// Single-page entry for an automatically built project: scripts/build-artifact.mjs
// points "@trm/auto-spec" and "@trm/auto-trace" at the project's data files.
import spec from "@trm/auto-spec";
import trace from "@trm/auto-trace";
import { AutoProjectEntry } from "@/features/selector/data/auto/entry";
import type { AutoSpec, AutoTrace } from "@/features/selector/data/auto/build";

export default function AutoEntry() {
  return <AutoProjectEntry spec={spec as unknown as AutoSpec} trace={(trace ?? null) as AutoTrace | null} />;
}
