# Audit and outstanding inputs

As at 3 October 2026. Recovery point before the seven-tab restructure:
commit `678096c` on `claude/web-dev-plugins-setup-y5ynix` (published as
Artifact version 19).

## Where each feature now sits

| Tab | Complete | Partial | Missing (needs your input) |
|---|---|---|---|
| **Project & 3D Site** | 3D model with the neighbourhood map, sun and shadows, facing, privacy and noise screening, view clearance by floor, renders, location | — | — |
| **Units & Payments** | Bedroom, budget, floor and block filters; unit number search; site view and unit list; selected-unit details; floor plans; price by floor; compare up to 3 units; suggested units | Payment estimate from the buyer's own figures (cash, CPF, loan, rate, period) | Developer's payment schedule (stage-by-stage payments), price list and availability, maintenance fees; official loan limits and stamp duty |
| **Schools** | Primary schools grouped by distance (within 1 km, 1–2 km, not measured yet); the proximity / eligibility / competition explanation | Ai Tong School: within 1 km of every block (about 400–480 m), **indicative**, measured from the OpenStreetMap school boundary, not the official OneMap check | Official OneMap distances for every primary school within 2 km (OneMap is blocked from the build environment; allow www.onemap.gov.sg under the environment's network access); past P1 results by phase; the registration year |
| **Investor** | JadeScape resale results by floor band (321 records), exit appeal score with its inputs and limits, JadeScape rents (881 leases) with an adjustable gross yield | Historical filters by bedrooms, purchase period and holding period | Confirmation of the JadeScape comparison facts; maintenance, property tax and vacancy assumptions for net income; more comparison projects |
| **Alternative Projects** | Four alternatives from TRM's comparison page (27 Sep 2026): Lentor Gardens Residences, Lentoria, Springleaf Residence, Chuan Park, with unit types, sizes, starting prices and units left; the selected unit against the closest size at each; all unit types by bedroom count beside Thomson Reserve's estimates | Developer, total units, tenure and completion from public listings and news (3 Oct 2026); Lentor Gardens Residences and Chuan Park completion dates differ between sources, so a range is shown | Updated starting prices and availability when they change; the developers' own completion dates |
| **PIVOT** | Your five scores and reasons; entry price from the land bid ($2,484 psf) and exit benchmark ($3,098 psf) reproduced exactly and editable; the selected unit against both; **exit outcomes by year of sale** (+4 years, around completion, to +10 years) at JadeScape's median yearly resale return (5.34% across 321 resales, or the unit's floor band), with a lower and higher case (25th and 75th percentile) | — | Break-even price, holding periods and downside/middle/upside selling prices; one worked unit example; the URA tender record for the $810M land bid |
| **My Upgrading Plan** | Valuation report request (address, unit, name, mobile or email); cash proceeds calculator (selling price − loan − CPF refund, optional selling costs, shortfall flagged for review); the shortlisted unit carried in. The service is described as an indicative market assessment by TRM, a Huttons Associate, not a formal valuation by a licensed valuer (confirmed by TRM, 3 Oct 2026) | The valuation request is recorded only when `LEAD_WEBHOOK_URL` is set on the website; the shareable page has no server, so it says requests can't be sent there. The site is generic, so no personal contact details are shown; a WhatsApp option appears only if a number is ever added in `src/content/site.ts` | Sell-first vs buy-first timelines (next phase): a fictional upgrader case, your consultation sequence, moving-cost assumptions |
| **My Shortlist** (all tabs) | Persistent list of up to 3 units, kept across tabs and visits | — | — |

## Already supplied and reused (no need to send again)

Factsheet (22 Sep 2026), elevation charts and unit plans (18 Sep 2026),
architect's brief, site plan, renders and location map, OpenStreetMap export,
JadeScape resale report (22 Sep 2026), JadeScape rental export (3 Oct 2026),
PIVOT e-book (2 Jul 2026).

## Facts that need your confirmation

1. **JadeScape comparison table**: Qingjian Realty, 1,206 homes, up to 23
   storeys, Marymount MRT.
2. **PIVOT e-book vs the factsheet.** These were left unchanged in the e-book
   at your request, but they differ from the developer's factsheet:
   - Storeys: "up to 24" (factsheet: 30)
   - Land size: "approx 504,314 sq ft" (factsheet: 51,567 sq m ≈ 555,063 sq ft)
   - Unit sizes on page 7 (for example, 4-bedroom premium 138–139 sq m;
     factsheet 127 sq m)
   - Page 8 price guide uses 1,496 sq ft for the 4-bedroom premium
     (Thomson Reserve's DP types are 1,367 sq ft)

Confirmed by TRM on 3 Oct 2026:

- Overall PIVOT rating: **8.8**, the average of the five scores.
- Land cost: **$1,178 psf ppr** as in the e-book, based on the 30-storey
  scheme. (For reference, $810M over the factsheet's site area × plot ratio
  2.1 gives about $695 psf ppr.)
- The website is generic: no agent name, CEA number or personal contact
  details are needed.

## Before publication

The current price list and availability, and where enquiries should be sent
(`LEAD_WEBHOOK_URL`). The site is generic, so no personal contact details are
needed.
