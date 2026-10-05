"use client";

import { SiteFooter } from "@/components/site-footer";
import { ProjectApp } from "../../components/project-app";
import { serraResidences } from "./bundle";

/** The Serra Residences' website. */
export default function SerraResidencesEntry() {
  return (
    <>
      <main id="top">
        <ProjectApp project={serraResidences} />
      </main>
      <SiteFooter disclaimer={serraResidences.copy.disclaimer} />
    </>
  );
}
