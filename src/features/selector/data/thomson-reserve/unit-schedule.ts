// Unit type of every home, by stack and level, from the developer's
// elevation charts ("TR Elevation & Unit Plan", 18 Sep 2026). "p" types sit
// at the lowest residential level with a private enclosed space (PES).
// Totals per type match the factsheet unit mix (22 Sep 2026): 1,268 homes.

export interface StackSchedule {
  /** Typical unit type for the stack. */
  type: string;
  /** Levels (inclusive) where the typical type repeats. */
  from: number;
  to: number;
  /** Other levels and their unit type, usually the PES variant. */
  other: Record<number, string>;
}

export const unitSchedule: Record<string, StackSchedule> = {
  "01": { type: "CP2", from: 3, to: 21, other: { 2: "CP2p" } },
  "02": { type: "BP3", from: 3, to: 21, other: { 2: "BP3p" } },
  "03": { type: "BP1", from: 3, to: 21, other: { 2: "BP1p" } },
  "04": { type: "BPS1", from: 3, to: 21, other: { 2: "BPS1p" } },
  "05": { type: "CPS1", from: 3, to: 21, other: { 2: "CPS1p" } },
  "06": { type: "CP1", from: 3, to: 21, other: { 2: "CP1p" } },
  "07": { type: "B1", from: 3, to: 21, other: { 2: "B1p" } },
  "08": { type: "B2", from: 3, to: 21, other: { 2: "B2p" } },
  "09": { type: "C1", from: 3, to: 21, other: { 2: "C1p" } },
  "10": { type: "CPS1", from: 3, to: 21, other: { 2: "CPS1p" } },
  "11": { type: "BPS1", from: 3, to: 21, other: { 2: "BPS1p" } },
  "12": { type: "BP3", from: 3, to: 21, other: { 2: "BP3p" } },
  "13": { type: "BP2", from: 3, to: 21, other: { 2: "BP2p" } },
  "14": { type: "D3", from: 3, to: 21, other: { 2: "D3p" } },
  "15": { type: "D2", from: 3, to: 21, other: { 2: "D2p" } },
  "16": { type: "B3", from: 3, to: 21, other: { 2: "B3p" } },
  "17": { type: "B1", from: 3, to: 21, other: { 2: "B1p" } },
  "18": { type: "CP1", from: 3, to: 21, other: { 2: "CP1p" } },
  "19": { type: "E1 (L)", from: 3, to: 30, other: {  } },
  "20": { type: "BP7 (L)", from: 2, to: 30, other: { 1: "BP7p (L)" } },
  "21": { type: "BP3 (L)", from: 3, to: 30, other: {  } },
  "22": { type: "DPS1 (L)", from: 3, to: 30, other: {  } },
  "23": { type: "C5 (L)", from: 2, to: 30, other: { 1: "C5p (L)" } },
  "24": { type: "BPS3 (L)", from: 2, to: 30, other: { 1: "BPS3p (L)" } },
  "25": { type: "BPS4 (L)", from: 2, to: 30, other: { 1: "BPS4p (L)" } },
  "26": { type: "BP6 (L)", from: 2, to: 30, other: { 1: "BP6p (L)" } },
  "27": { type: "D4 (L)", from: 2, to: 30, other: { 1: "D4p (L)" } },
  "28": { type: "CP7 (L)", from: 2, to: 30, other: { 1: "CP7p (L)" } },
  "29": { type: "BP2 (L)", from: 2, to: 30, other: { 1: "BP2p (L)" } },
  "30": { type: "BP3 (L)", from: 3, to: 30, other: {  } },
  "31": { type: "BPS2 (L)", from: 2, to: 30, other: { 1: "BPS2p (L)" } },
  "32": { type: "DP2 (L)", from: 3, to: 30, other: {  } },
  "33": { type: "C3 (L)", from: 2, to: 30, other: { 1: "C3p (L)" } },
  "34": { type: "BPS4 (L)", from: 2, to: 30, other: { 1: "BPS4p (L)" } },
  "35": { type: "BP6 (L)", from: 2, to: 30, other: { 1: "BP6p (L)" } },
  "36": { type: "DP1 (L)", from: 3, to: 30, other: {  } },
  "37": { type: "CP6", from: 3, to: 21, other: { 2: "CP6p" } },
  "38": { type: "BP1", from: 3, to: 21, other: { 2: "BP1p" } },
  "39": { type: "BP3", from: 3, to: 21, other: { 2: "BP3p" } },
  "40": { type: "C4", from: 3, to: 21, other: { 2: "C4p" } },
  "41": { type: "CPS2", from: 3, to: 21, other: { 2: "CPS2p" } },
  "42": { type: "BP9", from: 3, to: 21, other: { 2: "BP9p" } },
  "43": { type: "BP5", from: 3, to: 21, other: { 2: "BP5p" } },
  "44": { type: "BPS4", from: 3, to: 21, other: { 2: "BPS4p" } },
  "45": { type: "D1", from: 3, to: 21, other: { 2: "D1p" } },
  "46": { type: "CP3", from: 3, to: 21, other: { 2: "CP3p" } },
  "47": { type: "BP3", from: 3, to: 21, other: { 2: "BP3p" } },
  "48": { type: "BP4", from: 3, to: 21, other: { 2: "BP4p" } },
  "49": { type: "BP4", from: 3, to: 21, other: { 2: "BP4p" } },
  "50": { type: "CP4", from: 3, to: 21, other: { 2: "CP4p" } },
  "51": { type: "CP5", from: 3, to: 21, other: { 2: "CP5p" } },
  "52": { type: "B3", from: 3, to: 21, other: { 2: "B3p" } },
  "53": { type: "BP8", from: 3, to: 21, other: { 2: "BP8p" } },
  "54": { type: "BPS1", from: 3, to: 21, other: { 2: "BPS1p" } },
  "55": { type: "C2", from: 3, to: 21, other: { 2: "C2p" } },
};

export const UNIT_SCHEDULE_SOURCE = "Developer elevation chart and unit plans, 18 Sep 2026";
