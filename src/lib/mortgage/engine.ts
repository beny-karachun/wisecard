// One monthly cash-flow model for the simulator, optimizer, server and reports.
import {
  HOUSING_PTI_CHANGE_DATE,
  MAX_PRINCIPAL,
  MAX_TERM_MONTHS,
  PTI_MAX,
  RULES_REVIEWED_ON,
  TRACK_BY_TYPE,
  TRACKS,
  VARIABLE_MAX_PCT,
  maximumLoan,
  type TrackType,
} from "./tracks";
import {
  simulationSchema,
  constraintsSchema,
  stressSchema,
  inputError,
  type SimulationInput,
  type StoredLeg,
  type StressAssumptions,
} from "./input";
export type { SimulationInput, StoredLeg, StressAssumptions } from "./input";
export type RateMap = Record<TrackType, number>;
export type AllocMap = Partial<Record<TrackType, number>>;
export type TermMap = Partial<Record<TrackType, number>>;
export type MixConstraints = SimulationInput["constraints"] & {
  terms?: TermMap;
};
const EPS = 1e-7;
function bounded(value: number, min: number, max: number, name: string) {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new Error(`ערך לא תקין: ${name}`);
}
function validateTerm(months: number) {
  bounded(months, 1, MAX_TERM_MONTHS, "תקופה");
  if (!Number.isInteger(months))
    throw new Error("התקופה חייבת להיות בחודשים שלמים");
}
export function monthlyPayment(
  principal: number,
  annualRatePct: number,
  termMonths: number,
): number {
  bounded(principal, 0, Number.MAX_SAFE_INTEGER, "קרן");
  bounded(annualRatePct, 0, 40, "ריבית");
  validateTerm(termMonths);
  if (!principal) return 0;
  const r = annualRatePct / 1200;
  return r === 0
    ? principal / termMonths
    : (principal * r) / -Math.expm1(-termMonths * Math.log1p(r));
}
export interface AmortRow {
  month: number;
  payment: number;
  interest: number;
  indexation: number;
  principal: number;
  balance: number;
}

/** Index opening principal at each period, then accrue interest and repay. */
export function schedule(
  principal: number,
  annualRatePct: number,
  termMonths: number,
  annualCpiPct: number,
  linked: boolean,
  options: { resetMonths?: number | null; stress?: StressAssumptions } = {},
): AmortRow[] {
  bounded(principal, 0, MAX_PRINCIPAL, "קרן");
  bounded(annualCpiPct, -5, 25, "מדד");
  const stress = options.stress
    ? stressSchema.parse(options.stress)
    : undefined;
  if (options.resetMonths != null) validateTerm(options.resetMonths);
  bounded(annualCpiPct + (stress?.cpiBump ?? 0), -5, 25, "מדד בתרחיש לחץ");
  let payment = monthlyPayment(principal, annualRatePct, termMonths);
  let balance = principal,
    rate = annualRatePct,
    shocked = false;
  const rows: AmortRow[] = [];
  for (let month = 1; month <= termMonths; month++) {
    const affected = stress != null && month > stress.afterMonth;
    const cpi = annualCpiPct + (affected ? stress!.cpiBump : 0);
    const growth = linked ? Math.exp(Math.log1p(cpi / 100) / 12) : 1;
    const indexation = balance * (growth - 1);
    balance += indexation;
    payment *= growth;
    if (
      affected &&
      !shocked &&
      options.resetMonths &&
      (month - 1) % options.resetMonths === 0
    ) {
      rate = annualRatePct + stress!.rateBump;
      payment = monthlyPayment(balance, rate, termMonths - month + 1);
      shocked = true;
    }
    const interest = (balance * rate) / 1200;
    const actualPayment =
      month === termMonths
        ? balance + interest
        : Math.min(payment, balance + interest);
    const principalPaid = actualPayment - interest;
    balance = month === termMonths ? 0 : Math.max(0, balance - principalPaid);
    rows.push({
      month,
      payment: actualPayment,
      interest,
      indexation,
      principal: principalPaid,
      balance,
    });
  }
  return rows;
}
export function trackTotals(
  principal: number,
  rate: number,
  months: number,
  cpi: number,
  linked: boolean,
) {
  const rows = schedule(principal, rate, months, cpi, linked);
  const totalPaid = rows.reduce((s, r) => s + r.payment, 0);
  return {
    firstPayment: rows[0].payment,
    totalPaid,
    financingCost: totalPaid - principal,
  };
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
export interface RuleCheck {
  key: string;
  label: string;
  status: "pass" | "fail" | "incomplete";
  detail: string;
}
export interface MixResult {
  legs: MixLeg[];
  totalAmount: number;
  firstPayment: number;
  totalPaid: number;
  financingCost: number;
  totalInterest: number;
  totalIndexation: number;
  peakPayment: number;
  peakMonth: number;
  stressedPayment: number;
  stressedPeakPayment: number;
  stressedTotalPaid: number;
  stressObservationMonth: number;
  totalOutlay: number;
  firstOutlay: number;
  termMonths: number;
  primePct: number;
  variablePct: number;
  fixedPct: number;
  ltvPct: number | null;
  ptiPct: number | null;
  stressedPtiPct: number | null;
  disposableIncome: number | null;
  feasible: boolean;
  assessment: "pass" | "incomplete" | "fail";
  violations: string[];
  warnings: string[];
  checks: RuleCheck[];
}
export interface SimulationResult {
  input: SimulationInput;
  result: MixResult;
  rows: AmortRow[];
  stressRows: AmortRow[];
}

function assess(
  input: SimulationInput,
  firstPayment: number,
  stressedPayment: number,
  variablePct: number,
) {
  const opts = input.constraints;
  const checks: RuleCheck[] = [],
    warnings: string[] = [];
  const date = opts.approvalDate ?? RULES_REVIEWED_ON;
  if (!opts.approvalDate)
    checks.push({
      key: "date",
      label: "תאריך בחינה",
      status: "incomplete",
      detail: `לא הוזן תאריך אישור. לצורך חישוב ראשוני בלבד הונח ${RULES_REVIEWED_ON}.`,
    });
  if (date < "2026-02-08")
    checks.push({
      key: "historical",
      label: "כללים היסטוריים",
      status: "incomplete",
      detail:
        "תאריך זה קודם לטווח הכללים שנבדק במודל. יש לבדוק את ההוראות שחלו במועד המקורי.",
    });
  const aggregateMix =
    date >= HOUSING_PTI_CHANGE_DATE && (opts.existingHousingBalance ?? 0) > 0;
  const compositionUnknown =
    aggregateMix &&
    (opts.sameBankBalance == null || opts.sameBankVariableBalance == null);
  const checkedVariablePct =
    aggregateMix && !compositionUnknown
      ? (100 *
          ((input.amount * variablePct) / 100 +
            opts.sameBankVariableBalance!)) /
        (input.amount + opts.sameBankBalance!)
      : variablePct;
  checks.push({
    key: "mix",
    label: "ריבית משתנה",
    status: compositionUnknown
      ? "incomplete"
      : checkedVariablePct <= VARIABLE_MAX_PCT + EPS
        ? "pass"
        : "fail",
    detail: compositionUnknown
      ? "מתאריך 1.10.2026 נדרש פירוט יתרת האשראי והריבית המשתנה באותו בנק ובאותו נכס."
      : `${checkedVariablePct.toFixed(2)}% בריבית משתנה ${aggregateMix ? "כולל האשראי הנותר באותו בנק ובנכס" : "בתמהיל החדש"}; בדיקה בסיסית מול ${VARIABLE_MAX_PCT}%.`,
  });
  checks.push({
    key: "term",
    label: "תקופת הלוואה",
    status: "pass",
    detail: "כל המסלולים בטווח 1–360 חודשים.",
  });
  let disposableIncome: number | null = null,
    ptiPct: number | null = null,
    stressedPtiPct: number | null = null;
  const housingPayment = opts.existingHousingPayment ?? 0;
  const newPtiRule = date >= HOUSING_PTI_CHANGE_DATE;
  if (opts.monthlyIncome == null || opts.monthlyObligations == null) {
    checks.push({
      key: "pti",
      label: "יחס החזר להכנסה פנויה",
      status: "incomplete",
      detail:
        "חסרים הכנסה מוכרת או הוצאות קבועות. אין להסיק עמידה במגבלת ההחזר.",
    });
  } else {
    disposableIncome =
      opts.monthlyIncome -
      opts.monthlyObligations -
      (newPtiRule ? 0 : housingPayment);
    if (disposableIncome > 0) {
      ptiPct =
        (100 * (firstPayment + (newPtiRule ? housingPayment : 0))) /
        disposableIncome;
      stressedPtiPct =
        (100 * (stressedPayment + (newPtiRule ? housingPayment : 0))) /
        disposableIncome;
    }
    checks.push({
      key: "pti",
      label: "יחס החזר להכנסה פנויה",
      status: ptiPct != null && ptiPct <= PTI_MAX * 100 + EPS ? "pass" : "fail",
      detail:
        ptiPct == null
          ? "אין הכנסה פנויה חיובית לאחר ההוצאות הקבועות."
          : `${ptiPct.toFixed(1)}% לפי הנתונים שהוזנו (בדיקה בסיסית מול 50%).`,
    });
    if (ptiPct != null && ptiPct > 40)
      warnings.push("יחס ההחזר גבוה מ־40%; נדרשת בחינה זהירה של יכולת ההחזר.");
    if (stressedPtiPct != null && stressedPtiPct > 50)
      warnings.push("בתרחיש הלחץ ההחזר הנבחן עולה על 50% מההכנסה הפנויה.");
  }
  if (housingPayment > 0)
    warnings.push(
      newPtiRule
        ? "תשלומי הדיור הנותרים על אותו נכס נכללו במונה יחס ההחזר, בהתאם לתאריך שנבחר."
        : "לפני 1.10.2026 תשלומי הדיור הקיימים הוזנו כהוצאה קבועה. יש לוודא את סיווגם בבנק.",
    );
  if (
    opts.existingHousingPayment == null ||
    opts.existingHousingBalance == null
  )
    checks.push({
      key: "existing",
      label: "אשראי קיים בנכס",
      status: "incomplete",
      detail:
        "לא אושרו יתרות ותשלומי האשראי הנותר על הנכס. בחישוב המספרי הונח אפס.",
    });
  const value = opts.propertyValue;
  const balance = opts.existingHousingBalance ?? 0;
  const ltvPct =
    value && value > 0 ? (100 * (input.amount + balance)) / value : null;
  const basis = opts.ltvBasis;
  if (!basis || !value || value <= 0)
    checks.push({
      key: "ltv",
      label: "שיעור מימון",
      status: "incomplete",
      detail: "חסרים שווי נכס מוכר לבנק או פרופיל מימון.",
    });
  else if (basis === "REFINANCE") {
    checks.push({
      key: "ltv",
      label: "מיחזור",
      status: "incomplete",
      detail:
        opts.refinanceBalance == null
          ? "יש להזין את יתרת ההלוואה הממוחזרת; אין פטור כללי או תקרת מימון אוטומטית של 100%."
          : input.amount > opts.refinanceBalance + EPS
            ? "ההלוואה החדשה גבוהה מהיתרה למיחזור. נדרשת הפרדה בין אשראי נוסף למימון עמלות ובחינת החריגים בבנק; אין קביעה אוטומטית של אישור או איסור."
            : "הסכום אינו עולה על היתרה למיחזור. נדרשת בדיקת אי־יצירת חריגה או הגדלת חריגה ביחס להלוואה המקורית בבנק.",
    });
    warnings.push(
      "כללי מיחזור וחריגים להלוואה המקורית דורשים בדיקה פרטנית; התוצאה אינה אישור רגולטורי.",
    );
  } else {
    const cap = maximumLoan(value, basis, opts.consolidationConcession)!;
    checks.push({
      key: "ltv",
      label: "שיעור מימון כולל",
      status: input.amount + balance <= cap + EPS ? "pass" : "fail",
      detail: `${ltvPct!.toFixed(1)}% כולל אשראי נותר; סכום מרבי בבדיקה: ${Math.round(cap).toLocaleString("he-IL")} ₪.`,
    });
    if (basis === "CONSOLIDATION" && opts.consolidationConcession)
      checks.push({
        key: "concession",
        label: "הקלה לכל מטרה",
        status: "incomplete",
        detail:
          "נבחן הנמוך מבין 70% משווי הנכס ו־50% מהשווי ועוד 200,000 ₪. ההקלה נתונה לשיקול הבנק.",
      });
  }
  if (input.legs.some((l) => l.type === "ELIGIBILITY"))
    checks.push({
      key: "eligibility",
      label: "זכאות",
      status: "incomplete",
      detail:
        "סכום, ריבית ותקופת הזכאות דורשים אישור ותעודת זכאות. אין קביעה אוטומטית של זכאות או פטורים.",
    });
  if (basis === "CONSOLIDATION" && input.amount + balance <= 120000)
    warnings.push(
      "בהלוואות קטנות לכל מטרה עשויים לחול חריגים פרטניים. הבדיקה הבסיסית כאן אינה מיישמת אותם אוטומטית.",
    );
  const violations = checks
    .filter((c) => c.status === "fail")
    .map((c) => c.detail);
  const incomplete = checks.some((c) => c.status === "incomplete");
  return {
    checks,
    warnings,
    violations,
    ltvPct,
    ptiPct,
    stressedPtiPct,
    disposableIncome,
    feasible: !violations.length,
    assessment: violations.length
      ? ("fail" as const)
      : incomplete
        ? ("incomplete" as const)
        : ("pass" as const),
  };
}
function blankRows(months: number): AmortRow[] {
  return Array.from({ length: months }, (_, i) => ({
    month: i + 1,
    payment: 0,
    interest: 0,
    indexation: 0,
    principal: 0,
    balance: 0,
  }));
}
function addRows(target: AmortRow[], source: AmortRow[], fraction = 1) {
  for (let i = 0; i < source.length; i++) {
    const to = target[i],
      from = source[i];
    to.payment += from.payment * fraction;
    to.interest += from.interest * fraction;
    to.indexation += from.indexation * fraction;
    to.principal += from.principal * fraction;
    to.balance += from.balance * fraction;
  }
}
function summarize(
  input: SimulationInput,
  rows: AmortRow[],
  stressRows: AmortRow[],
  legs: MixLeg[],
): MixResult {
  const totalPaid = rows.reduce((s, r) => s + r.payment, 0),
    firstPayment = rows[0].payment;
  const max = rows.reduce(
    (best, r) => (r.payment > best.payment + 0.005 ? r : best),
    rows[0],
  );
  const stressedPeakPayment = Math.max(...stressRows.map((r) => r.payment));
  const month = input.stress.afterMonth + 1;
  const stressedPayment = stressRows[month - 1]?.payment ?? 0;
  const variablePct = legs.reduce(
    (s, l) => s + (TRACK_BY_TYPE[l.type].variable ? l.pct : 0),
    0,
  );
  return {
    legs,
    totalAmount: input.amount,
    termMonths: rows.length,
    firstPayment,
    totalPaid,
    financingCost: totalPaid - input.amount,
    totalInterest: rows.reduce((s, r) => s + r.interest, 0),
    totalIndexation: rows.reduce((s, r) => s + r.indexation, 0),
    peakPayment: max.payment,
    peakMonth: max.month,
    stressedPayment,
    stressedPeakPayment,
    stressObservationMonth: month,
    stressedTotalPaid: stressRows.reduce((s, r) => s + r.payment, 0),
    totalOutlay:
      totalPaid + input.upfrontCosts + input.monthlyInsurance * rows.length,
    firstOutlay: firstPayment + input.monthlyInsurance,
    primePct: legs.find((l) => l.type === "PRIME")?.pct ?? 0,
    fixedPct: 100 - variablePct,
    variablePct,
    ...assess(input, firstPayment, stressedPayment, variablePct),
  };
}
export function simulate(rawInput: unknown): SimulationResult {
  const parsed = simulationSchema.safeParse(rawInput);
  if (!parsed.success) throw new Error(inputError(parsed.error));
  const input = parsed.data;
  const maxTerm = Math.max(
    ...input.legs.map((l) => l.termMonths ?? input.termMonths),
  );
  const rows = blankRows(maxTerm),
    stressRows = blankRows(maxTerm);
  const legs = input.legs.map((leg) => {
    const def = TRACK_BY_TYPE[leg.type],
      term = leg.termMonths ?? input.termMonths,
      amount = (input.amount * leg.pct) / 100;
    const base = schedule(amount, leg.rate, term, input.cpi, def.linked);
    const stressed = schedule(amount, leg.rate, term, input.cpi, def.linked, {
      resetMonths: def.resetMonths,
      stress: input.stress,
    });
    addRows(rows, base);
    addRows(stressRows, stressed);
    return {
      ...leg,
      termMonths: term,
      label: def.label,
      amount,
      firstPayment: base[0].payment,
      totalPaid: base.reduce((s, r) => s + r.payment, 0),
    };
  });
  return {
    input,
    rows,
    stressRows,
    result: summarize(input, rows, stressRows, legs),
  };
}
export function evaluateMix(
  alloc: AllocMap,
  amount: number,
  termMonths: number,
  rates: RateMap,
  cpi: number,
  opts: MixConstraints = {},
): MixResult {
  for (const [key, pct] of Object.entries(alloc))
    if (
      !(key in TRACK_BY_TYPE) ||
      !Number.isFinite(pct) ||
      pct! < 0 ||
      pct! > 100
    )
      throw new Error("הקצאת מסלולים לא תקינה");
  return simulate({
    amount,
    termMonths,
    cpi,
    constraints: opts,
    legs: TRACKS.filter((t) => (alloc[t.type] ?? 0) > 0).map((t) => ({
      type: t.type,
      pct: alloc[t.type],
      rate: rates[t.type],
      termMonths: opts.terms?.[t.type] ?? termMonths,
    })),
  }).result;
}
export interface OptimizeInput {
  amount: number;
  termMonths: number;
  rates: RateMap;
  cpi: number;
  constraints?: MixConstraints;
  stepPct?: number;
  tracks?: TrackType[];
  stress?: StressAssumptions;
  monthlyInsurance?: number;
  upfrontCosts?: number;
}
export interface OptimizeResult {
  byCost: MixResult | null;
  byPayment: MixResult | null;
  byRisk: MixResult | null;
  balanced: MixResult | null;
  evaluated: number;
  feasibleCount: number;
  stepPct: number;
}
function* compositions(units: number, slots: number): Generator<number[]> {
  if (slots === 1) {
    yield [units];
    return;
  }
  for (let i = 0; i <= units; i++)
    for (const rest of compositions(units - i, slots - 1)) yield [i, ...rest];
}
function combinationCount(n: number, k: number) {
  let result = 1;
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i;
  return result;
}
export function optimize(input: OptimizeInput): OptimizeResult {
  const step = input.stepPct ?? 5,
    types =
      input.tracks ?? TRACKS.filter((t) => t.inOptimizer).map((t) => t.type);
  if (
    !Number.isFinite(step) ||
    step <= 0 ||
    step > 100 ||
    Math.abs(100 / step - Math.round(100 / step)) > EPS
  )
    throw new Error("גודל צעד החיפוש חייב לחלק את 100 ללא שארית");
  if (
    !types.length ||
    types.length > 7 ||
    new Set(types).size !== types.length ||
    types.some((t) => !(t in TRACK_BY_TYPE))
  )
    throw new Error("יש לבחור רשימת מסלולים תקינה ללא כפילויות");
  const units = Math.round(100 / step);
  if (combinationCount(units + types.length - 1, types.length - 1) > 50000)
    throw new Error("החיפוש גדול מדי; יש להגדיל את הצעד או לצמצם מסלולים");
  const constraints = constraintsSchema.parse(input.constraints ?? {}),
    stress = stressSchema.parse(input.stress ?? {});
  // Precompute schedules per unit of allocation; cash flows are linear in principal.
  const prepared = types.map((type) =>
    simulate({
      amount: input.amount,
      termMonths: input.termMonths,
      cpi: input.cpi,
      constraints,
      stress,
      monthlyInsurance: input.monthlyInsurance ?? 0,
      upfrontCosts: input.upfrontCosts ?? 0,
      legs: [
        {
          type,
          pct: 100,
          rate: input.rates[type],
          termMonths: input.constraints?.terms?.[type] ?? input.termMonths,
        },
      ],
    }),
  );
  let byCost: MixResult | null = null,
    byPayment: MixResult | null = null,
    byRisk: MixResult | null = null;
  const candidates: MixResult[] = [];
  let evaluated = 0;
  for (const combo of compositions(units, types.length)) {
    evaluated++;
    const variablePct = combo.reduce(
      (sum, n, i) => sum + (TRACK_BY_TYPE[types[i]].variable ? n * step : 0),
      0,
    );
    if (
      variablePct > VARIABLE_MAX_PCT + EPS &&
      !(
        (constraints.approvalDate ?? RULES_REVIEWED_ON) >=
          HOUSING_PTI_CHANGE_DATE &&
        (constraints.existingHousingBalance ?? 0) > 0
      )
    )
      continue;
    const active = prepared.filter((_, i) => combo[i] > 0);
    const maxTerm = Math.max(...active.map((p) => p.rows.length));
    const rows = blankRows(maxTerm),
      stressRows = blankRows(maxTerm);
    const legs: MixLeg[] = [];
    for (let i = 0; i < types.length; i++)
      if (combo[i]) {
        const fraction = (combo[i] * step) / 100,
          p = prepared[i],
          l = p.result.legs[0];
        addRows(rows, p.rows, fraction);
        addRows(stressRows, p.stressRows, fraction);
        legs.push({
          ...l,
          pct: combo[i] * step,
          amount: l.amount * fraction,
          firstPayment: l.firstPayment * fraction,
          totalPaid: l.totalPaid * fraction,
        });
      }
    const simulatedInput = {
      ...prepared[0].input,
      legs: legs.map((l) => ({
        type: l.type,
        pct: l.pct,
        rate: l.rate,
        termMonths: l.termMonths,
      })),
    };
    const result = summarize(simulatedInput, rows, stressRows, legs);
    if (!result.feasible) continue;
    candidates.push(result);
    if (!byCost || result.totalOutlay < byCost.totalOutlay) byCost = result;
    if (!byPayment || result.firstPayment < byPayment.firstPayment)
      byPayment = result;
    if (!byRisk || result.stressedPeakPayment < byRisk.stressedPeakPayment)
      byRisk = result;
  }
  let balanced: MixResult | null = null,
    bestScore = Infinity;
  if (byCost && byPayment && byRisk)
    for (const r of candidates) {
      const score =
        r.totalOutlay / byCost.totalOutlay +
        r.firstPayment / byPayment.firstPayment +
        r.stressedPeakPayment / byRisk.stressedPeakPayment;
      if (score < bestScore) {
        bestScore = score;
        balanced = r;
      }
    }
  return {
    byCost,
    byPayment,
    byRisk,
    balanced,
    evaluated,
    feasibleCount: candidates.length,
    stepPct: step,
  };
}
export function defaultRates(): RateMap {
  return Object.fromEntries(
    TRACKS.map((t) => [t.type, t.defaultRate]),
  ) as RateMap;
}
export interface Milestone {
  year: number;
  month: number;
  payment: number;
  balance: number;
  paid: number;
  interest: number;
  indexation: number;
}
export function annualMilestones(rows: AmortRow[]): Milestone[] {
  const result: Milestone[] = [];
  for (let start = 0; start < rows.length; start += 12) {
    const period = rows.slice(start, start + 12),
      end = period.at(-1)!;
    result.push({
      year: Math.floor(start / 12) + 1,
      month: end.month,
      payment: end.payment,
      balance: end.balance,
      paid: period.reduce((s, r) => s + r.payment, 0),
      interest: period.reduce((s, r) => s + r.interest, 0),
      indexation: period.reduce((s, r) => s + r.indexation, 0),
    });
  }
  return result;
}
export function blendedMilestones(
  legs: StoredLeg[],
  amount: number,
  termMonths: number,
  cpi: number,
) {
  return annualMilestones(simulate({ legs, amount, termMonths, cpi }).rows);
}
export { TRACKS, TRACK_BY_TYPE };
