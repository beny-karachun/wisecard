// Mortgage math: Spitzer amortization, CPI-linked schedules, mix evaluation,
// and the constrained mix optimizer ("WISE AI" — a search, not an LLM).

import {
  FIXED_MIN_FRACTION,
  LTV_CAPS,
  PRIME_MAX_FRACTION,
  PTI_MAX,
  STRESS_CPI_BUMP,
  STRESS_MONTH,
  STRESS_RATE_BUMP,
  TRACK_BY_TYPE,
  TRACKS,
  type LtvBasis,
  type TrackType,
} from "./tracks";

export type RateMap = Record<TrackType, number>; // annual % per track
export type AllocMap = Partial<Record<TrackType, number>>; // % of total per track
export type TermMap = Partial<Record<TrackType, number>>; // months per track

/** Spitzer (annuity) monthly payment. */
export function monthlyPayment(
  principal: number,
  annualRatePct: number,
  termMonths: number,
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths));
}

/**
 * Totals for a single track in closed form.
 * Linked tracks: principal and payment grow by the assumed CPI each month, so
 * nominal total = M · Σ(1+c)^t. Real-frame amortization still pays off at term.
 */
export function trackTotals(
  principal: number,
  annualRatePct: number,
  termMonths: number,
  annualCpiPct: number,
  linked: boolean,
): { firstPayment: number; totalPaid: number; financingCost: number } {
  const M = monthlyPayment(principal, annualRatePct, termMonths);
  const c = linked ? annualCpiPct / 100 / 12 : 0;
  const totalPaid =
    c === 0
      ? M * termMonths
      : (M * (Math.pow(1 + c, termMonths) - 1)) / c;
  return { firstPayment: M, totalPaid, financingCost: totalPaid - principal };
}

export interface AmortRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

/** Full month-by-month schedule (nominal terms) for display. */
export function schedule(
  principal: number,
  annualRatePct: number,
  termMonths: number,
  annualCpiPct: number,
  linked: boolean,
): AmortRow[] {
  const r = annualRatePct / 100 / 12;
  const c = linked ? annualCpiPct / 100 / 12 : 0;
  const M = monthlyPayment(principal, annualRatePct, termMonths);
  let realBalance = principal;
  let factor = 1;
  const rows: AmortRow[] = [];
  for (let t = 1; t <= termMonths; t++) {
    const interestReal = realBalance * r;
    const principalReal = M - interestReal;
    realBalance -= principalReal;
    rows.push({
      month: t,
      payment: M * factor,
      interest: interestReal * factor,
      principal: principalReal * factor,
      balance: Math.max(0, realBalance) * factor,
    });
    factor *= 1 + c;
  }
  return rows;
}

/**
 * A leg's estimated payment at `atMonth` under the BOI-style stress scenario:
 * variable rates +2pp, CPI +1.5pp. Approximation — the shocked rate is applied
 * from month 1 rather than re-amortized at actual reset dates.
 */
function stressedLegPayment(
  amount: number,
  rate: number,
  termMonths: number,
  cpi: number,
  type: TrackType,
  atMonth = STRESS_MONTH,
): number {
  const def = TRACK_BY_TYPE[type];
  const shockedRate = rate + (def.variable ? STRESS_RATE_BUMP : 0);
  const M = monthlyPayment(amount, shockedRate, termMonths);
  const c = def.linked ? (cpi + STRESS_CPI_BUMP) / 100 / 12 : 0;
  const m = Math.min(atMonth, termMonths);
  return M * Math.pow(1 + c, m - 1);
}

export interface MixLeg {
  type: TrackType;
  label: string;
  pct: number;
  amount: number;
  rate: number;
  termMonths: number;
  firstPayment: number;
  totalPaid: number;
}

export interface MixResult {
  legs: MixLeg[];
  totalAmount: number;
  firstPayment: number;
  totalPaid: number;
  financingCost: number;
  stressedPayment: number; // est. monthly payment at year 5 under stress
  primePct: number;
  fixedPct: number;
  ltvPct: number | null; // loan / property value, when a value is known
  feasible: boolean;
  violations: string[];
}

export interface MixConstraints {
  monthlyIncome?: number;
  monthlyObligations?: number;
  propertyValue?: number;
  ltvBasis?: LtvBasis;
  terms?: TermMap; // per-track term override (months)
}

const EPS = 1e-6;

export function evaluateMix(
  alloc: AllocMap,
  amount: number,
  termMonths: number,
  rates: RateMap,
  cpi: number,
  opts: MixConstraints = {},
): MixResult {
  const legs: MixLeg[] = [];
  let firstPayment = 0;
  let totalPaid = 0;
  let stressedPayment = 0;
  let primePct = 0;
  let fixedPct = 0;

  for (const def of TRACKS) {
    const pct = alloc[def.type] ?? 0;
    if (pct <= 0) continue;
    const legAmount = (amount * pct) / 100;
    const rate = rates[def.type];
    const legTerm = opts.terms?.[def.type] ?? termMonths;
    const totals = trackTotals(legAmount, rate, legTerm, cpi, def.linked);
    legs.push({
      type: def.type,
      label: def.label,
      pct,
      amount: legAmount,
      rate,
      termMonths: legTerm,
      firstPayment: totals.firstPayment,
      totalPaid: totals.totalPaid,
    });
    firstPayment += totals.firstPayment;
    totalPaid += totals.totalPaid;
    stressedPayment += stressedLegPayment(legAmount, rate, legTerm, cpi, def.type);
    if (def.isPrime) primePct += pct;
    if (def.fixed) fixedPct += pct;
  }

  const violations: string[] = [];
  if (fixedPct < FIXED_MIN_FRACTION * 100 - EPS) {
    violations.push(`מסלול קבוע נמוך מ-⅓ (${Math.round(fixedPct)}%)`);
  }
  if (primePct > PRIME_MAX_FRACTION * 100 + EPS) {
    violations.push(`פריים גבוה מ-⅔ (${Math.round(primePct)}%)`);
  }

  const income = opts.monthlyIncome ?? 0;
  const obligations = opts.monthlyObligations ?? 0;
  if (income > 0) {
    if (firstPayment + obligations > income * PTI_MAX + EPS) {
      violations.push(
        obligations > 0
          ? "החזר + התחייבויות מעל 50% מההכנסה"
          : "החזר חודשי מעל 50% מההכנסה",
      );
    }
  }

  let ltvPct: number | null = null;
  if (opts.propertyValue && opts.propertyValue > 0) {
    ltvPct = (amount / opts.propertyValue) * 100;
    const cap = LTV_CAPS[opts.ltvBasis ?? "FIRST_HOME"] * 100;
    if (ltvPct > cap + EPS) {
      violations.push(
        `מימון ${Math.round(ltvPct)}% משווי הנכס — מעל תקרת ${Math.round(cap)}%`,
      );
    }
  }

  return {
    legs,
    totalAmount: amount,
    firstPayment,
    totalPaid,
    financingCost: totalPaid - amount,
    stressedPayment,
    primePct,
    fixedPct,
    ltvPct,
    feasible: violations.length === 0,
    violations,
  };
}

export interface OptimizeInput {
  amount: number;
  termMonths: number;
  rates: RateMap;
  cpi: number;
  constraints?: MixConstraints;
  stepPct?: number; // allocation granularity, default 5
  tracks?: TrackType[]; // tracks to consider; default: mainstream tracks
}

export interface OptimizeResult {
  byCost: MixResult | null; // lowest total cost
  byPayment: MixResult | null; // lowest monthly payment
  byRisk: MixResult | null; // lowest stressed payment
  balanced: MixResult | null; // closest to all optima
  evaluated: number;
  feasibleCount: number;
}

/** Generate compositions of `units` across `slots` (each ≥ 0, summing to units). */
function* compositions(units: number, slots: number): Generator<number[]> {
  if (slots === 1) {
    yield [units];
    return;
  }
  for (let i = 0; i <= units; i++) {
    for (const rest of compositions(units - i, slots - 1)) {
      yield [i, ...rest];
    }
  }
}

export function optimize(input: OptimizeInput): OptimizeResult {
  const step = input.stepPct ?? 5;
  const types =
    input.tracks ?? TRACKS.filter((t) => t.inOptimizer).map((t) => t.type);
  const units = Math.round(100 / step);

  let byCost: MixResult | null = null;
  let byPayment: MixResult | null = null;
  let byRisk: MixResult | null = null;
  let evaluated = 0;
  let feasibleCount = 0;
  const feasible: MixResult[] = [];

  for (const combo of compositions(units, types.length)) {
    const alloc: AllocMap = {};
    for (let i = 0; i < types.length; i++) {
      if (combo[i] > 0) alloc[types[i]] = combo[i] * step;
    }
    const result = evaluateMix(
      alloc,
      input.amount,
      input.termMonths,
      input.rates,
      input.cpi,
      input.constraints,
    );
    evaluated++;
    if (!result.feasible) continue;
    feasibleCount++;
    feasible.push(result);
    if (!byCost || result.totalPaid < byCost.totalPaid) byCost = result;
    if (!byPayment || result.firstPayment < byPayment.firstPayment) {
      byPayment = result;
    }
    if (!byRisk || result.stressedPayment < byRisk.stressedPayment) {
      byRisk = result;
    }
  }

  // "Balanced": minimise normalised distance to the three optima.
  let balanced: MixResult | null = null;
  if (byCost && byPayment && byRisk) {
    const bestCost = byCost.totalPaid;
    const bestPay = byPayment.firstPayment;
    const bestStress = byRisk.stressedPayment;
    let bestScore = Infinity;
    for (const r of feasible) {
      const score =
        r.totalPaid / bestCost +
        r.firstPayment / bestPay +
        r.stressedPayment / bestStress;
      if (score < bestScore) {
        bestScore = score;
        balanced = r;
      }
    }
  }

  return { byCost, byPayment, byRisk, balanced, evaluated, feasibleCount };
}

export function defaultRates(): RateMap {
  return Object.fromEntries(
    TRACKS.map((t) => [t.type, t.defaultRate]),
  ) as RateMap;
}

// A persisted mix leg (stored as JSON on a Scenario). `termMonths` is absent
// on legs saved before per-leg terms existed — fall back to the scenario term.
export interface StoredLeg {
  type: TrackType;
  pct: number;
  rate: number;
  termMonths?: number;
}

export interface Milestone {
  year: number;
  payment: number; // blended monthly payment that year
  balance: number; // remaining balance at year-end
}

/** Year-by-year blended milestones across all legs, for the report. */
export function blendedMilestones(
  legs: StoredLeg[],
  amount: number,
  termMonths: number,
  cpi: number,
): Milestone[] {
  const perLeg = legs.map((leg) => {
    const legTerm = leg.termMonths ?? termMonths;
    return {
      term: legTerm,
      rows: schedule(
        (amount * leg.pct) / 100,
        leg.rate,
        legTerm,
        cpi,
        TRACK_BY_TYPE[leg.type].linked,
      ),
    };
  });
  const maxTerm = Math.max(termMonths, ...perLeg.map((l) => l.term));
  const termYears = Math.ceil(maxTerm / 12);
  const rows: Milestone[] = [];
  for (let y = 1; y <= termYears; y++) {
    const m = Math.min(y * 12, maxTerm);
    let payment = 0;
    let balance = 0;
    for (const sch of perLeg) {
      if (m > sch.term) continue; // leg fully repaid
      payment += sch.rows[m - 1].payment;
      balance += sch.rows[m - 1].balance;
    }
    rows.push({ year: y, payment, balance });
  }
  return rows;
}

export { TRACKS, TRACK_BY_TYPE };
