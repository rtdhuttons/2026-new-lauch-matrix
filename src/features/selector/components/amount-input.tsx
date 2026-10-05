"use client";

import type { InputHTMLAttributes } from "react";
import { useRef, useState } from "react";

/** "1803000" -> "1,803,000". */
export function withCommas(n: number | null): string {
  return n === null || !Number.isFinite(n) ? "" : Math.round(n).toLocaleString("en-SG");
}

/**
 * A whole-dollar amount typed with thousands separators (1,803,000). Accepts
 * pasted text such as "$1.8m"-free figures by keeping only the digits, and
 * keeps the cursor beside the digit being typed.
 */
export function AmountInput({
  value,
  onChange,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & { value: number | null; onChange: (v: number | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  // While typing, show exactly what was typed (even an empty box), formatted;
  // the parent may fall back to a default for an empty value.
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={draft ?? withCommas(value)}
      onBlur={(e) => {
        setDraft(null);
        rest.onBlur?.(e);
      }}
      onChange={(e) => {
        const el = e.target;
        const caret = el.selectionStart ?? el.value.length;
        const digitsBefore = el.value.slice(0, caret).replace(/\D/g, "").length;
        const digits = el.value.replace(/\D/g, "");
        setDraft(digits === "" ? "" : withCommas(Number(digits)));
        onChange(digits === "" ? null : Number(digits));
        // Put the cursor back after the same digit once the commas move.
        requestAnimationFrame(() => {
          const input = ref.current;
          if (!input) return;
          let seen = 0;
          let pos = 0;
          while (pos < input.value.length && seen < digitsBefore) {
            if (/\d/.test(input.value[pos])) seen += 1;
            pos += 1;
          }
          input.setSelectionRange(pos, pos);
        });
      }}
    />
  );
}
