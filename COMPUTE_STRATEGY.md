# Compute Strategy

## Why compute on demand rather than precomputing

The full combinatorial space of (region × household composition × earnings point) is large. There are 12 UK ITL-1 regions, 4 canonical household templates plus arbitrary custom compositions, and a default earnings curve of 271 points from £0 to £135,000. A complete precomputed grid would require thousands of PolicyEngine UK simulations to be run offline, serialised to disk, and kept in sync every time `policyengine-uk` is updated. Any policy change in the upstream package would silently invalidate the stored results unless the entire grid was regenerated.

PolicyEngine UK evaluates a single household in well under a second in most cases. An earnings-curve series (271 points, resolved in one axis sweep by the PolicyEngine simulation engine) typically completes in a few seconds. A regions call (the same earnings point evaluated 12 times in sequence) similarly completes in a few seconds. These latencies are acceptable for an interactive web tool where a user has just changed a parameter and expects a brief loading state.

## Caching

Because serverless invocations for the same parameters may be routed to the same warm container, all four computation paths are wrapped in `functools.lru_cache(maxsize=256)` in `api/_shared.py`. The cache key is the JSON-serialised `HouseholdInput` dataclass (keys sorted for stability), plus `max_earned_income` and `step` for the series endpoint. Identical requests within the same process lifetime hit the cache and return instantly.

In the local dev server (`uk_cliff_watch.dev_server`) the process is long-lived, so the cache accumulates across requests for the session.

## Modelled bundle

Each simulation covers:

- **Benefits**: Universal Credit (55% taper above the work allowance), Child Benefit (subject to the High-Income Child Benefit Charge above £60,000), Child Tax Credit, Working Tax Credit, Housing Benefit, Pension Credit, Tax-Free Childcare (hard cliff at £100,000 adjusted net income), free childcare hours, Carer's Allowance, UC carer element.
- **Taxes and repayments**: Income Tax (including the 60% effective rate between £100,000 and £125,140 as the personal allowance is withdrawn), employee Class 1 National Insurance, Council Tax, Student Loan Repayment.

The benefit and tax variable names are listed in `uk_cliff_watch/config.py` (`BENEFIT_COMPONENTS`, `TAX_COMPONENTS`) and map directly to `policyengine-uk` variable names passed to `Simulation.calculate()`.

## Output metric

The primary output metric is `household_net_income` from PolicyEngine UK:

```
household_net_income = household_market_income + total_benefits − income_tax − national_insurance − council_tax
```

An earnings series is produced by building a single `Simulation` with an `axes` sweep over `employment_income` for the primary earner, from £0 (or a computed minimum) to `max_earned_income` in `count` equally-spaced steps. This is more efficient than running one simulation per point because PolicyEngine resolves the entire axis in a single vectorised pass.

The effective marginal tax rate at a point is computed as:

```
EMTR = 1 − (net_income(x + Δ) − net_income(x)) / Δ
```

where Δ is `DEFAULT_CLIFF_DELTA` (£1,000 by default). A cliff is identified when `net_income(x + Δ) < net_income(x)`, i.e. earning more reduces the household's resources.

An after-housing-costs view is also returned:

```
net_after_housing = net_income − rent_annual
```

This is a simple arithmetic deduction applied to the PolicyEngine output; rent itself is passed as an input to the simulation so that Housing Benefit can be calculated correctly.
