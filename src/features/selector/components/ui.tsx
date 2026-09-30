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
