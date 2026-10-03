# Sample intake files

Fictional examples of the files to prepare for a new project. **Every value
here is made up** for a fictional "Wrenfield Residences" and must not be used
for a real development.

| File | What it shows |
|---|---|
| `price-list.sample.csv` | A dated price list with availability |
| `unit-schedule.sample.csv` | Unit type for each stack and floor, from the elevation charts |
| `unit-types.sample.csv` | Area, bedrooms and features per unit type |
| `payment-schedule.sample.csv` | The developer's payment stages |
| `rentals.sample.csv` | Rental contracts in the Huttons / URA export format |
| `schools.sample.csv` | Schools with official distances and P1 results |
| `alternatives.sample.csv` | Alternative projects with labelled, dated prices |
| `sources.sample.csv` | The source register: item, kind, source, checked date |

The rentals file can be turned into project data with
`python3 scripts/data/rentals-from-csv.py`. The others are copied into the
project's bundle by hand for now (see `docs/adding-a-project.md`).
