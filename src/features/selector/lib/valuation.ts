// Checks a valuation report request before it is sent. Shared by the
// website's server action and the shareable page, so both give the same
// messages.

export type ContactMethod = "mobile" | "email";

export interface ValuationRequest {
  project: string;
  address: string;
  unitNumber: string;
  name: string;
  contactMethod: ContactMethod;
  contact: string;
}

export type ValuationState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "sent"; name: string };

const SG_MOBILE = /^(\+65\s?)?[89]\d{3}\s?\d{4}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function readValuationForm(formData: FormData): ValuationRequest {
  const text = (k: string) => String(formData.get(k) ?? "").trim();
  return {
    project: text("project"),
    address: text("address"),
    unitNumber: text("unitNumber"),
    name: text("name"),
    contactMethod: text("contactMethod") === "email" ? "email" : "mobile",
    contact: text("contact"),
  };
}

/** The first problem with the request, or null if it can be sent. */
export function checkValuationRequest(r: ValuationRequest): string | null {
  if (r.address.length < 3) return "Enter your property's address or postal code.";
  if (!r.name) return "Enter your name.";
  if (r.contactMethod === "mobile" && !SG_MOBILE.test(r.contact)) return "Enter a Singapore mobile number, for example 9123 4567.";
  if (r.contactMethod === "email" && !EMAIL.test(r.contact)) return "Enter an email address, for example name@example.com.";
  return null;
}
