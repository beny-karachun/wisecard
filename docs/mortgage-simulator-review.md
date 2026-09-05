# Mortgage simulator review — 2026-09-05

## Findings and implementation decisions

| Severity | Before | Required correction |
| --- | --- | --- |
| Critical | Saved client-supplied totals and `feasible` | Validate inputs, recompute on the server, save a versioned assumptions snapshot |
| High | PTI used `(payment + obligations) / income` | Use recognized income less fixed expenses; explicitly separate continuing housing payments and date-dependent rules |
| High | Refinancing was treated as a blanket 100% LTV allowance | Remove that allowance; require existing balance and flag manual assessment of the original loan |
| High | Missing income/property inputs still produced a green regulatory approval | Distinguish failed checks, incomplete checks and indicative passed checks |
| High | CPI used annual percentage divided by 12; first period indexing was inconsistent with balances | Compound an effective annual assumption monthly and expose indexation separately |
| High | Stress rates were applied from origination and repaid loans still contributed payments | Re-amortize remaining principal at the next contractual reset after the shock; zero payments after maturity |
| High | Allocations rounding to 100% were accepted; terms silently capped; numeric bounds absent | Validate exact total within numerical tolerance, finite bounded inputs, whole-month terms and every active leg |
| Medium | Optimizer ran during render and claimed all legal mixes / minimum risk | Explicit worker-based finite-grid search; show scope, stale results, cancellation and actual objective |
| Medium | Market history and editable assumptions looked like bank quotes / forecasts | Identify default/reference rates, source dates and stale data; CPI forecast is explicitly user-defined |
| Medium | Report recomputed old legs alongside previously saved unverified totals | Treat old records as legacy; version new simulations and reproduce from their saved input |

## Official references

- [Directive 329, version 13 and circular 2852 (30 June 2026)](https://www.boi.org.il/media/hjrlkrse/h2852.pdf).
- [Circular 2840 (8 February 2026)](https://www.boi.org.il/media/ptciib1v/h2840.pdf).
- [Directive 329 Q&A](https://www.boi.org.il/media/lgjpehuy/202601.pdf).

The standard purchase limits are 75% / 70% / 50%, variable-rate lending is
limited to 66.66%, and the standard term limit is 360 months. PTI is payment
relative to disposable recognized income. Qualifying fixed expenses reduce
income. Circular 2852 defers the same-property housing-payment change until
1 October 2026. These payments must not also be deducted as fixed expenses.
The discretionary non-purchase concession is limited to the lower of 70% LTV
and 50% of property value plus ILS 200,000. It is not automatic approval.
Refinancing requires comparison with the original exposure and must not be
presented as a general exemption. Subsidized housing, guarantees, state-funded
loans and other special exceptions require separate bank review.

## Model scope

Monthly Spitzer schedules; annual nominal loan interest divided by 12; annual
CPI assumption converted to monthly effective growth. Each full monthly period
indexes the opening balance before interest and payment. No contractual index
floor, index-publication lag or broken first period is modeled. Rates remain
unchanged in the baseline. A scenario rate shock takes effect at the next reset
(1 month for prime, 12 for MAKAM, 60 for five-year variable tracks). CPI changes
from the month after the specified shock boundary. Payments stop at maturity.
Insurance and up-front costs are user-entered estimates, outside regulatory PTI.
No automatic bank approval, early repayment fee, grace/balloon schedule or future
market prediction is inferred.

## Validation completed

- 39 unit tests (27 mortgage-engine/input tests and 12 workspace tests), including
  100 deterministic randomized base/stress amortization scenarios, accounting
  identities, payoff, exact allocation and rule boundaries, optimizer equivalence,
  date transitions and versioned snapshot round trips.
- 53 authenticated HTTP/database assertions: actual server actions, recomputation
  despite tampered totals/flags, invalid allocation rejection, own-office reports,
  cross-office denial, reopening snapshots, legacy handling and totals above the
  old 32-bit integer limit. Only isolated synthetic fixtures were created and removed.
- Production optimizer bundle executed in a worker-like VM for successful search
  and invalid-input responses. Default five-track, 5% grid: 10,626 allocations;
  an observed local engine run took approximately 0.7 seconds (not a browser SLA).
- TypeScript, ESLint and production build passed. No connected browser was
  available, so visual layout, browser interactions, downloads and print preview
  have not been manually verified.

Database change reviewed and applied: nullable `Scenario.snapshot` JSONB plus
`firstPayment` / `totalPaid` widened to double precision. Existing records retained.
Refinancing above the original balance remains **incomplete**, since financed
fees and new credit need separate bank assessment; it is not an automatic failure.
Dates before the modeled 2026 rule set are explicitly marked incomplete.

To repeat the built-worker smoke check after a production build:
`node --import tsx tests/optimizer-build.smoke.ts`.
