// Checks a project bundle before it goes on the website. Errors are data
// that would show something wrong; "missing" lists the optional sections a
// buyer will see as "not supplied yet", so the intake checklist can be
// followed up.

import type { ProjectBundle } from "../model/project";

export interface ProjectCheck {
  errors: string[];
  missing: string[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function checkProject(p: ProjectBundle): ProjectCheck {
  const errors: string[] = [];
  const missing: string[] = [];
  const ds = p.dataset;

  if (!/^[a-z0-9-]+$/.test(p.id)) errors.push(`Project id "${p.id}" must be lower-case letters, digits and hyphens.`);
  if (ds.project.name !== p.profile.name) errors.push(`Dataset name "${ds.project.name}" differs from profile name "${p.profile.name}".`);
  if (ds.project.totalUnits !== ds.units.length) errors.push(`totalUnits is ${ds.project.totalUnits} but ${ds.units.length} units are listed.`);

  const blocks = new Map(ds.blocks.map((b) => [b.id, b]));
  const layouts = new Set(ds.layouts.map((l) => l.id));
  const stacks = new Map(ds.stacks.map((s) => [s.id, s]));
  for (const s of ds.stacks) {
    if (!blocks.has(s.blockId)) errors.push(`Stack ${s.id} refers to unknown block ${s.blockId}.`);
    if (!layouts.has(s.layoutId)) errors.push(`Stack ${s.id} refers to unknown layout ${s.layoutId}.`);
  }
  const seen = new Set<string>();
  for (const u of ds.units) {
    if (seen.has(u.id)) errors.push(`Unit ${u.id} is listed twice.`);
    seen.add(u.id);
    const s = stacks.get(u.stackId);
    if (!s) {
      errors.push(`Unit ${u.id} refers to unknown stack ${u.stackId}.`);
      continue;
    }
    const b = blocks.get(s.blockId);
    if (b && (u.level < b.firstResidentialLevel || u.level > b.storeys)) {
      errors.push(`Unit ${u.id} is on level ${u.level}, outside ${b.name}'s homes (levels ${b.firstResidentialLevel}–${b.storeys}).`);
    }
    if (u.price !== null && u.price <= 0) errors.push(`Unit ${u.id} has a price of ${u.price}.`);
  }

  for (const r of p.sources) {
    if (!ISO_DATE.test(r.checked)) errors.push(`Source "${r.item}" needs a checked date as YYYY-MM-DD (has "${r.checked}").`);
  }
  if (p.sources.length === 0) errors.push("The source register is empty.");

  if (p.status === "sample" && !/sample|fictional/i.test(p.copy.eyebrow + p.copy.tagline)) {
    errors.push("A sample project must say it is a sample or fictional in its opening words.");
  }
  if (p.pricing.estimate && !p.pricing.estimateProvenance) errors.push("Illustrative pricing needs a provenance saying it is an assumption.");

  if (!p.media.hero) missing.push("Opening image");
  if (p.media.gallery.length === 0) missing.push("Gallery images");
  if (!ds.project.display?.planImage) missing.push("Site plan image");
  if (!p.location) missing.push("Location information");
  if (!p.pricing.priceList) missing.push("Developer's price list");
  if (!p.payments.schedule) missing.push("Payment schedule");
  if (!p.profile.expectedCompletion) missing.push("Expected completion date");
  if (!p.schools || p.schools.schools.length === 0) missing.push("Schools");
  if (p.comparables.length === 0) missing.push("Comparison project resale records");
  if (p.rentals.length === 0) missing.push("Rental evidence");
  if (p.alternatives.length === 0) missing.push("Alternative projects");
  if (!p.pivot.scores) missing.push("PIVOT assessment");

  return { errors, missing };
}
