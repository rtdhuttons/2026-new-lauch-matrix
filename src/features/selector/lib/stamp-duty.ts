// Stamp duty on buying a home in Singapore (IRAS rates for residential
// property: Buyer's Stamp Duty from 15 Feb 2023, Additional Buyer's Stamp
// Duty from 27 Apr 2023). Both are due within 14 days of signing.

export type BuyerProfile = "sc-1" | "sc-2" | "sc-3" | "pr-1" | "pr-2" | "pr-3" | "foreigner";

export const BUYER_PROFILES: { id: BuyerProfile; label: string; absd: number }[] = [
  { id: "sc-1", label: "Singapore citizen, first home", absd: 0 },
  { id: "sc-2", label: "Singapore citizen, second home", absd: 0.2 },
  { id: "sc-3", label: "Singapore citizen, third or later home", absd: 0.3 },
  { id: "pr-1", label: "Permanent resident, first home", absd: 0.05 },
  { id: "pr-2", label: "Permanent resident, second home", absd: 0.3 },
  { id: "pr-3", label: "Permanent resident, third or later home", absd: 0.35 },
  { id: "foreigner", label: "Foreigner", absd: 0.6 },
];

/** Residential BSD bands: [amount in the band, rate]. */
const BSD_BANDS: [number, number][] = [
  [180_000, 0.01],
  [180_000, 0.02],
  [640_000, 0.03],
  [500_000, 0.04],
  [1_500_000, 0.05],
  [Infinity, 0.06],
];

export const STAMP_DUTY_SOURCE = "IRAS: Buyer's Stamp Duty rates from 15 Feb 2023; Additional Buyer's Stamp Duty rates from 27 Apr 2023";

export function buyerStampDuty(price: number): number {
  let left = price;
  let duty = 0;
  for (const [band, rate] of BSD_BANDS) {
    const part = Math.min(left, band);
    duty += part * rate;
    left -= part;
    if (left <= 0) break;
  }
  return Math.round(duty);
}

export function stampDuty(price: number, profile: BuyerProfile) {
  const absdRate = BUYER_PROFILES.find((p) => p.id === profile)?.absd ?? 0;
  const bsd = buyerStampDuty(price);
  const absd = Math.round(price * absdRate);
  return { bsd, absd, absdRate, total: bsd + absd };
}
