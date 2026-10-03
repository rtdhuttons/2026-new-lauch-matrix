"use client";

import { SiteFooter } from "@/components/site-footer";
import { ProjectApp } from "../../components/project-app";
import { sampleProject } from "./bundle";

/** The fictional sample project, for checking the template. Never published. */
export default function SampleProjectEntry() {
  return (
    <>
      <main id="top">
        <ProjectApp project={sampleProject} />
      </main>
      <SiteFooter disclaimer={sampleProject.copy.disclaimer} />
    </>
  );
}
