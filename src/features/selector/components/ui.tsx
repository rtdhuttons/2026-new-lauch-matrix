import type { ReactNode } from "react";
import type { DataStatus, Provenance } from "../model/types";
import type { ViewCategory } from "../lib/clearance";
import { VIEW_CATEGORY_LABEL } from "../lib/clearance";

const STATUS_STYLE: Record<DataStatus, string> = {
  verified: "bg-reservoir/10 text-reservoir border-reservoir/30",
  estimated: "bg-[#f4ead3] text-[#7a5410] border-[#e2cf9f]",
  assumed: "bg-mist-deep text-canopy/75 border-canopy/15",
  unknown: "bg-paper text-stone border-dashed border-stone/50",
};

const STATUS_LABEL: Record<DataStatus, string> = {
  verified: "Verified",
  estimated: "Estimated",
  assumed: "Assumed",
  unknown: "Unknown",
};

export function StatusChip({
  status,
  provenance,
}: {
  status: DataStatus;
  provenance?: Provenance;
}) {
  const title = provenance
    ? `${STATUS_LABEL[status]} — ${provenance.source}, updated ${provenance.updated}${provenance.note ? `. ${provenance.note}` : ""}`
    : STATUS_LABEL[status];
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-display-normal text-[0.75rem] font-medium leading-none ${STATUS_STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * Bedroom-count colours, shared by the 3D view and the price chart. Checked
 * with the dataviz palette validator (lightness, chroma, colour-blind and
 * normal-vision separation on white); always shown with a text label.
 */
export const BEDROOM_COLOURS: Record<number, string> = { 2: "#2a78d6", 3: "#eb6834", 4: "#4a3aa7", 5: "#1baf7a" };

export const VIEW_COLOURS: Record<ViewCategory, string> = {
  below: "#c3cac3",
  partial: "#9cc2cb",
  clear: "#2e6a78",
  "clear-limited": "#1d4751",
  unknown: "#e6e8e4",
};

export function ViewChip({ category, uncertain }: { category: ViewCategory; uncertain?: boolean }) {
  const dark = category === "clear" || category === "clear-limited";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-display-normal text-sm font-medium leading-none"
      style={{ background: VIEW_COLOURS[category], color: dark ? "#fff" : "#10291c" }}
    >
      {VIEW_CATEGORY_LABEL[category]}
      {uncertain && <span className="font-normal opacity-80">(uncertain)</span>}
    </span>
  );
}

export function SectionHeading({
  id,
  title,
  lede,
  children,
}: {
  id?: string;
  title: string;
  lede?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-[62ch]">
        <h2 id={id} className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">
          {title}
        </h2>
        {lede && <p className="mt-2 text-canopy/75">{lede}</p>}
      </div>
      {children}
    </div>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 font-display-normal text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-1 rounded-lg bg-mist-deep p-1">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={`flex-1 rounded-md px-3 py-1.5 font-display-normal text-sm font-medium ${
                active ? "bg-paper text-canopy shadow-sm" : "text-canopy/70 hover:text-canopy"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <dt className="font-display-normal text-sm text-stone">{label}</dt>
      <dd className="mt-0.5 font-display-normal text-lg font-semibold tabular-nums">{value}</dd>
      {sub && <dd className="text-sm text-canopy/70">{sub}</dd>}
    </div>
  );
}

export const card = "rounded-xl border border-canopy/10 bg-paper";

/** One prominent action per task area; secondary and text actions are quieter. */
export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-canopy px-5 py-2.5 font-display-normal text-sm font-semibold text-mist hover:bg-canopy-soft disabled:cursor-not-allowed disabled:opacity-40";
export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-canopy/25 bg-paper px-5 py-2.5 font-display-normal text-sm font-semibold text-canopy hover:bg-mist-deep disabled:cursor-not-allowed disabled:opacity-40";
export const btnText = "font-display-normal text-sm font-semibold text-reservoir underline underline-offset-4 hover:text-canopy";

/** A clearly named expandable section; the summary says what's inside. */
export function Disclosure({
  title,
  hint,
  children,
  open,
  onToggle,
  id,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  id?: string;
}) {
  return (
    <details
      id={id}
      open={open}
      onToggle={onToggle ? (e) => onToggle(e.currentTarget.open) : undefined}
      className="group scroll-mt-24 rounded-xl border border-canopy/10 bg-paper"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 font-display-normal [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[0.9375rem] font-semibold">{title}</span>
          {hint && <span className="block text-sm text-canopy/70">{hint}</span>}
        </span>
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full border border-canopy/20 text-base transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="border-t border-canopy/10 p-4">{children}</div>
    </details>
  );
}

/** Suggests one logical next action at the end of a task. */
export function NextStep({ label, onClick, note }: { label: string; onClick: () => void; note?: string }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-mist-deep/70 px-4 py-3">
      <p className="font-display-normal text-sm text-canopy/80">{note ?? "Next step"}</p>
      <button type="button" onClick={onClick} className={btnPrimary}>
        {label} →
      </button>
    </div>
  );
}

/** The standard note for any page or section that shows figures. */
export const NUMBERS_DISCLAIMER =
  "All figures here, including prices, payments, stamp duty, loan amounts, returns, rents, scores and distances, are estimates for general information only, worked out from the sources, dates and assumptions shown. They are not financial, legal, tax or valuation advice, nor an offer or price from the developer, and they can change without notice. Past results do not guarantee future returns. Please check with the developer, your bank, IRAS and a licensed professional before you decide.";

export function NumbersDisclaimer({ className = "" }: { className?: string }) {
  return (
    <aside aria-label="Important note about the figures" className={`rounded-xl border border-[#e2cf9f] bg-[#fbf5e6] px-4 py-3 font-display-normal text-[0.8125rem] leading-relaxed text-[#5c3f0b] ${className}`}>
      <strong className="font-semibold">Important: </strong>
      {NUMBERS_DISCLAIMER}
    </aside>
  );
}
