"use server";

export type RegisterState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "sent"; name: string };

const SG_MOBILE = /^(\+65\s?)?[89]\d{3}\s?\d{4}$/;

export async function registerInterest(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const name = String(formData.get("name") ?? "").trim();
  const mobile = String(formData.get("mobile") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const unitType = String(formData.get("unitType") ?? "");
  const consent = formData.get("consent") === "on";

  if (!name) return { status: "error", message: "Enter your name." };
  if (!SG_MOBILE.test(mobile)) {
    return {
      status: "error",
      message: "Enter a Singapore mobile number, for example 9123 4567.",
    };
  }
  if (!consent) {
    return {
      status: "error",
      message: "Tick the consent box so we can contact you about the preview.",
    };
  }

  const webhook = process.env.LEAD_WEBHOOK_URL;
  if (!webhook) {
    return {
      status: "error",
      message:
        "Online registration isn't connected yet. Please contact TRM directly.",
    };
  }

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project: String(formData.get("project") ?? "").trim() || "Not stated",
      name,
      mobile,
      email,
      unitType,
      submittedAt: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    return {
      status: "error",
      message: "Your registration didn't go through. Try again in a minute.",
    };
  }
  return { status: "sent", name };
}
