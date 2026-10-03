"use client";

import { SiteFooter } from "@/components/site-footer";
import { ProjectApp } from "../../components/project-app";
import { thomsonReserve } from "./bundle";

/** Thomson Reserve's website. Each project has a three-line entry like this. */
export default function ThomsonReserveEntry() {
  return (
    <>
      <main id="top">
        <ProjectApp project={thomsonReserve} />
      </main>
      <SiteFooter disclaimer={thomsonReserve.copy.disclaimer} />
    </>
  );
}
