"use client";

import { useActionState } from "react";
import { registerInterest, type RegisterState } from "@/app/actions";

const field =
  "mt-1.5 block w-full rounded-md border border-mist/25 bg-canopy-soft px-3.5 py-2.5 font-display-normal text-base text-mist placeholder:text-mist/40 focus:border-reservoir-light focus:outline-none";
const label = "font-display-normal text-sm font-medium text-mist/80";

export function RegisterForm({ unitTypes }: { unitTypes: string[] }) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    registerInterest,
    { status: "idle" },
  );

  if (state.status === "sent") {
    return (
      <div role="status" className="rounded-lg border border-reservoir-light/40 p-6">
        <p className="font-display text-lg font-bold">You&apos;re registered</p>
        <p className="mt-2 text-mist/80">
          Thanks, {state.name}. TRM will send your preview slot and the price
          list before the preview opens.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2">
        <label htmlFor="name" className={label}>
          Name
        </label>
        <input id="name" name="name" autoComplete="name" required className={field} />
      </div>
      <div>
        <label htmlFor="mobile" className={label}>
          Mobile
        </label>
        <input
          id="mobile"
          name="mobile"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="9123 4567"
          required
          className={field}
        />
      </div>
      <div>
        <label htmlFor="email" className={label}>
          Email <span className="text-mist/50">(optional)</span>
        </label>
        <input id="email" name="email" type="email" autoComplete="email" className={field} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="unitType" className={label}>
          Unit type you&apos;re considering
        </label>
        <select id="unitType" name="unitType" className={field} defaultValue="">
          <option value="">Not sure yet</option>
          {unitTypes.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <label className="flex items-start gap-3 text-sm text-mist/80 sm:col-span-2">
        <input
          type="checkbox"
          name="consent"
          className="mt-1 size-4 shrink-0 accent-reservoir-light"
        />
        <span>
          I agree to TRM contacting me by phone, SMS, WhatsApp or email about
          Thomson Reserve, in line with the PDPA.
        </span>
      </label>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-[#f3b8a8] sm:col-span-2">
          {state.message}
        </p>
      )}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-mist px-6 py-3 font-display-normal text-base font-semibold text-canopy hover:bg-paper disabled:opacity-60"
        >
          {pending ? "Registering…" : "Register for preview"}
        </button>
      </div>
    </form>
  );
}
