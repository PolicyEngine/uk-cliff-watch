# UK CliffWatch

Dynamic benefit-cliff and marginal-rate explorer for UK households, built on PolicyEngine UK.

---

## What this shows

- **Net income as gross earnings rise** — traces `household_net_income` from £0 up to £80,000 gross per year so you can see exactly how much a household keeps at every point on the earnings curve.
- **Benefit cliffs** — points where net income drops sharply as earnings cross a threshold (e.g. the Tax-Free Childcare hard cliff, the High-Income Child Benefit Charge entry point).
- **Effective marginal tax rates (EMTRs)** — the fraction of the next £1,000 of gross earnings lost to tax rises or benefit withdrawal; the Universal Credit 55% taper stacking on top of income tax and National Insurance creates combined rates above 70% for many working families; the £100k–£125,140 band produces a 60% EMTR through the personal-allowance taper.
- **Program-level breakdown** of every modelled component:
  - Benefits: Universal Credit, Child Benefit, Child Tax Credit, Working Tax Credit, Housing Benefit, Council Tax Reduction, Pension Credit, Tax-Free Childcare, Free School Meals.
  - Taxes: Income Tax, National Insurance, Council Tax.
- **Regional comparison** — runs the same household across all 12 UK ITL-1 regions (North East, North West, Yorkshire and the Humber, East Midlands, West Midlands, East of England, London, South East, South West, Wales, Scotland, Northern Ireland) so you can see how Council Tax and locally-administered benefit rates shift the curve.
- **Household-type comparison** — side-by-side view across four canonical templates: single adult (no children), lone parent with 2 children, couple with 2 children, couple with no children.

---

## The core metric

```
net_income = household_net_income   (PolicyEngine UK)
           = market_income + total_benefits − income_tax − national_insurance − council_tax
```

An **after-housing-costs** view is also computed:

```
net_after_housing = net_income − rent_annual
```

All figures are annual (£). Monthly equivalents (÷ 12) are returned alongside.

---

## Architecture

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 / React 19 / Recharts 2 / Tailwind CSS 4 |
| Runtime calculations | Python 3.11+ · policyengine-uk ≥ 2.88.0 |
| Local dev API | `http.server.ThreadingHTTPServer` on `127.0.0.1:8000` |
| Deployment | Static frontend export (`next build` → `frontend/out`) + Vercel serverless `api/*.py` handlers |

---

## No precomputation

Calculations are run **on demand** per request. There is no precomputed data file to keep in sync. Each unique `(region, household, earnings)` combination is computed once per process lifetime and stored in an `lru_cache(maxsize=256)` in `api/_shared.py`. See [COMPUTE_STRATEGY.md](COMPUTE_STRATEGY.md) for the full rationale.

---

## Getting started

### Python (backend)

This project targets Python 3.13 (conda env `python313` on the development machine). Any Python ≥ 3.11 with `policyengine-uk` installed works.

```bash
# Activate the conda environment (dev machine)
eval "$(conda shell.bash hook)"
conda activate python313

# Install the package in editable mode (installs policyengine-uk)
pip install -e .
# or: pip install -r requirements.txt
```

**Run the dev API server** (listens on `http://127.0.0.1:8000`):

```bash
PYTHONPATH=. python -m uk_cliff_watch.dev_server
# or use the installed script entrypoint:
uk-cliff-watch-dev-server
```

**CLI smoke tests:**

```bash
PYTHONPATH=. python -m uk_cliff_watch.calculator examples/sample_household.json --mode household
PYTHONPATH=. python -m uk_cliff_watch.calculator examples/sample_household.json --mode series
PYTHONPATH=. python -m uk_cliff_watch.calculator examples/sample_household.json --mode regions
PYTHONPATH=. python -m uk_cliff_watch.calculator examples/sample_household.json --mode households
```

### Frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_API_ORIGIN=http://127.0.0.1:8000 npm run dev
```

The frontend reads `NEXT_PUBLIC_API_ORIGIN` for all API calls. In production on Vercel the API handlers are co-located, so no environment variable is needed.

---

## API endpoints

All endpoints are CORS-open and return `application/json`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/metadata` | Returns country, currency, year, region list, household templates, program definitions, defaults. No request body. |
| `POST` | `/api/calculate` | Single-point household calculation + cliff/EMTR at `earned_income`. |
| `POST` | `/api/series` | Full earnings curve from £0 to `max_earned_income` (default £80,000). Accepts optional `max_earned_income` and `step` (default £500) in the body alongside the household payload. |
| `POST` | `/api/regions` | Runs the household at `earned_income` across all 12 UK regions. |
| `POST` | `/api/households` | Runs all four canonical household templates at `earned_income` in the given region. |

### Request body — `HouseholdPayload`

```jsonc
{
  "region": "NORTH_WEST",           // UK ITL-1 region code (see /api/metadata for full list)
  "earned_income": 25000,           // gross annual employment income of the primary earner (£)
  "year": 2026,                     // tax year (optional, defaults to 2026)
  "rent_annual": 9000,              // annual rent (£); 0 if not renting
  "is_renting": true,               // whether the benefit unit is a renter (for Housing Benefit)
  "childcare_expenses_annual": 0,   // annual childcare spend (£, used for Tax-Free Childcare)
  "people": [                       // household members
    { "kind": "adult", "age": 35 },
    { "kind": "child", "age": 4  },
    { "kind": "child", "age": 7  }
  ]
}
```

Responses are JSON objects whose shape is documented in `uk_cliff_watch/calculator.py`.

---

## Modelled scope and caveats

- **v1 models** the main means-tested benefits (Universal Credit, Child Benefit, Child/Working Tax Credit, Housing Benefit, Council Tax Reduction, Pension Credit, Tax-Free Childcare, Free School Meals) and the main direct taxes (Income Tax, National Insurance, Council Tax).
- **Council Tax Reduction** is locally administered and varies by council; the model uses the PolicyEngine UK approximation.
- **Disability benefits** (DLA, PIP, Carer's Allowance, ESA) are not yet modelled.
- **Childcare cliffs** are partially modelled via Tax-Free Childcare; the 15/30-hours free childcare thresholds are not yet reflected.
- All figures are modelled estimates for **tax year 2026**, computed by PolicyEngine UK version ≥ 2.88.0. They are not financial or legal advice.

---

## Credit and licence

Built on [PolicyEngine UK](https://github.com/PolicyEngine/policyengine-uk).
Ported from [PolicyEngine/cliff-watch](https://github.com/PolicyEngine/cliff-watch).

Licence: MIT
