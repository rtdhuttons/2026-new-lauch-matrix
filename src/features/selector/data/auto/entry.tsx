"use client";

import { useMemo } from "react";
import { SiteFooter } from "@/components/site-footer";
import { ProjectApp } from "../../components/project-app";
import { buildAutoBundle, type AutoSpec, type AutoTrace } from "./build";
import type { ComparableLeases } from "../comparables/rents";
import { ComingSoon } from "./coming-soon";

/** A project's mini site, built from its data file (and site plan tracing, if any). */
export function AutoProjectEntry({ spec, trace, rents = null }: { spec: AutoSpec; trace: AutoTrace | null; rents?: ComparableLeases | null }) {
  const project = useMemo(() => buildAutoBundle(spec, trace, rents), [spec, trace, rents]);
  return (
    <>
      <main id="top">{spec.units.length ? <ProjectApp project={project} /> : <ComingSoon spec={spec} project={project} />}</main>
      <SiteFooter disclaimer={project.copy.disclaimer} />
    </>
  );
}
