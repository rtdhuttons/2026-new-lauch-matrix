import type { Project } from "../model/types";

export function money(n: number): string {
  return `$${Math.round(n).toLocaleString("en-SG")}`;
}

export function signedMoney(n: number): string {
  if (Math.round(n) === 0) return "$0";
  return `${n > 0 ? "+" : "−"}$${Math.abs(Math.round(n)).toLocaleString("en-SG")}`;
}

export function compactMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  return `${sign}$${Math.round(abs)}`;
}

export function psfText(n: number): string {
  return `$${Math.round(n).toLocaleString("en-SG")} psf`;
}

export function pct(n: number, digits = 1): string {
  return `${n >= 0 ? "" : "−"}${Math.abs(n).toFixed(digits)}%`;
}

export function metres(n: number): string {
  return `${Math.round(n).toLocaleString("en-SG")} m`;
}

export function levelText(level: number): string {
  return `Level ${level}`;
}

export function areaText(areaSqft: number | null): string {
  return areaSqft === null ? "Size not published" : `${areaSqft.toLocaleString("en-SG")} sq ft`;
}

/** "Type 3A, 3 bedrooms, 947 sq ft", or just the name when not confirmed. */
export function layoutSummary(layout: {
  name: string;
  category?: string;
  bedrooms: number | null;
  areaSqft: number | null;
}): string {
  if (layout.bedrooms === null) return layout.name;
  const kind = layout.category ?? `${layout.bedrooms} bedrooms`;
  return `${layout.name}, ${kind}${layout.areaSqft !== null ? `, ${areaText(layout.areaSqft)}` : ""}`;
}

/** True for a developer "p" type: the lowest-level home with a private enclosed space. */
export function isPesType(typeCode: string | undefined): boolean {
  return !!typeCode && /p( \(L\))?$/.test(typeCode);
}

/** A level in the project's height datum, e.g. "14.5 m above Upper Thomson Road" or "RL 26 m". */
export function heightText(project: Project, rl: number): string {
  const v = Number.isInteger(rl) ? String(rl) : rl.toFixed(1);
  return project.heightDatum ? `${v} m above ${project.heightDatum}` : `RL ${v} m`;
}
