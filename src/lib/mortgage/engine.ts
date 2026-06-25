// Mortgage math: Spitzer amortization, CPI-linked schedules, mix evaluation,
// and the constrained mix optimizer ("WISE AI" — a search, not an LLM).

import {
  FIXED_MIN_FRACTION,
  PRIME_MAX_FRACTION,
  PTI_MAX,
  TRACK_BY_TYPE,
  TRACKS,
  type TrackType,
} from "./tracks";

export type RateMap = Record<TrackType, number>; // annual % per track
export type AllocMap = Partial<Record<TrackType, number>>; // % of total per track

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

export interface MixLeg {
  type: TrackType;
  label: string;
  pct: number;
  amount: number;
  rate: number;
  firstPayment: number;
  totalPaid: number;
}

export interface MixResult {
  legs: MixLeg[];
  totalAmount: number;
  firstPayment: number;
  totalPaid: number;
  financingCost: number;
  primePct: number;
  fixedPct: number;
  feasible: boolean;
  violations: string[];
}

const EPS = 1e-6;

export function evaluateMix(
  alloc: AllocMap,
  amount: number,
  termMonths: number,
  rates: RateMap,
  cpi: number,
  opts: { monthlyIncome?: number } = {},
): MixResult {
  const legs: MixLeg[] = [];
  let firstPayment = 0;
  let totalPaid = 0;
  let primePct = 0;
  let fixedPct = 0;

  for (const def of TRACKS) {
    const pct = alloc[def.type] ?? 0;
    if (pct <= 0) continue;
    const legAmount = (amount * pct) / 100;
    const rate = rates[def.type];
    const totals = trackTotals(legAmount, rate, termMonths, cpi, def.linked);
    legs.push({
      type: def.type,
      label: def.label,
      pct,
      amount: legAmount,
      rate,
      firstPayment: totals.firstPayment,
      totalPaid: totals.totalPaid,
    });
    firstPayment += totals.firstPayment;
    totalPaid += totals.totalPaid;
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
  if (opts.monthlyIncome && opts.monthlyIncome > 0) {
    if (firstPayment > opts.monthlyIncome * PTI_MAX + EPS) {
      violations.push("החזר חודשי מעל 50% מההכנסה");
    }
  }

  return {
    legs,
    totalAmount: amount,
    firstPayment,
    totalPaid,
    financingCost: totalPaid - amount,
    primePct,
    fixedPct,
    feasible: violations.length === 0,
    violations,
  };
}

export interface OptimizeInput {
  amount: number;
  termMonths: number;
  rates: RateMap;
  cpi: number;
  monthlyIncome?: number;
  stepPct?: number; // allocation granularity, default 5
  tracks?: TrackType[]; // tracks to consider, default all
}

export interface OptimizeResult {
  byCost: MixResult | null; // lowest total cost
  byPayment: MixResult | null; // lowest monthly payment
  balanced: MixResult | null; // closest to both optima
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
  const types = input.tracks ?? TRACKS.map((t) => t.type);
  const units = Math.round(100 / step);

  let byCost: MixResult | null = null;
  let byPayment: MixResult | null = null;
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
      { monthlyIncome: input.monthlyIncome },
    );
    evaluated++;
    if (!result.feasible) continue;
    feasibleCount++;
    feasible.push(result);
    if (!byCost || result.totalPaid < byCost.totalPaid) byCost = result;
    if (!byPayment || result.firstPayment < byPayment.firstPayment) {
      byPayment = result;
    }
  }

  // "Balanced": minimise normalised distance to both optima.
  let balanced: MixResult | null = null;
  if (byCost && byPayment) {
    const bestCost = byCost.totalPaid;
    const bestPay = byPayment.firstPayment;
    let bestScore = Infinity;
    for (const r of feasible) {
      const score = r.totalPaid / bestCost + r.firstPayment / bestPay;
      if (score < bestScore) {
        bestScore = score;
        balanced = r;
      }
    }
  }

  return { byCost, byPayment, balanced, evaluated, feasibleCount };
}

export function defaultRates(): RateMap {
  return Object.fromEntries(
    TRACKS.map((t) => [t.type, t.defaultRate]),
  ) as RateMap;
}

// A persisted mix leg (stored as JSON on a Scenario).
export interface StoredLeg {
  type: TrackType;
  pct: number;
  rate: number;
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
  const perLeg = legs.map((leg) =>
    schedule(
      (amount * leg.pct) / 100,
      leg.rate,
      termMonths,
      cpi,
      TRACK_BY_TYPE[leg.type].linked,
    ),
  );
  const termYears = Math.ceil(termMonths / 12);
  const rows: Milestone[] = [];
  for (let y = 1; y <= termYears; y++) {
    const m = Math.min(y * 12, termMonths);
    let payment = 0;
    let balance = 0;
    for (const sch of perLeg) {
      payment += sch[m - 1].payment;
      balance += sch[m - 1].balance;
    }
    rows.push({ year: y, payment, balance });
  }
  return rows;
}

export { TRACKS, TRACK_BY_TYPE };
