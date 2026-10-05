// Placeholder until the first run of scripts/ura/sync-transactions.py, which
// needs URA_ACCESS_KEY. That run replaces this file with the sales and rents
// of private homes near every project on the map.

import type { MarketData } from "../model";

export const uraMarket: MarketData = {
  source: "URA Data Service (private residential transactions and rental contracts)",
  fetched: "",
  radiusKm: 2,
  rentalPeriod: "",
  projects: [],
};
