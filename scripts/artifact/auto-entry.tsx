"use client";

// Single-page entry for an automatically built project: scripts/build-artifact.mjs
// points "@trm/auto-spec" and "@trm/auto-trace" at the project's data files.
import spec from "@trm/auto-spec";
import trace from "@trm/auto-trace";
import rents from "@trm/auto-rents";
import { AutoProjectEntry } from "@/features/selector/data/auto/entry";
import type { AutoSpec, AutoTrace } from "@/features/selector/data/auto/build";
import type { ComparableLeases } from "@/features/selector/data/comparables/rents";

export default function AutoEntry() {
  return <AutoProjectEntry spec={spec as unknown as AutoSpec} trace={(trace ?? null) as AutoTrace | null} rents={(rents ?? null) as ComparableLeases | null} />;
}
