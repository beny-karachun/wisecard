"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Check, Save } from "lucide-react";
import {
  defaultRates,
  evaluateMix,
  optimize,
  TRACKS,
  type AllocMap,
  type MixConstraints,
  type MixResult,
  type RateMap,
  type TermMap,
} from "@/lib/mortgage/engine";
import {
  DEFAULT_CPI,
  LTV_CAPS,
  MAX_TERM_MONTHS,
  type LtvBasis,
  type TrackType,
} from "@/lib/mortgage/tracks";
import { ltvBasisLabel } from "@/lib/labels";
import { formatCurrency } from "@/lib/format";
import { saveScenario } from "@/app/app/actions";

const TRACK_COLORS: Record<TrackType, string> = {
  PRIME: "bg-blue-500",
  FIXED_UNLINKED: "bg-emerald-500",
  FIXED_LINKED: "bg-teal-500",
  VARIABLE_UNLINKED: "bg-amber-500",
  VARIABLE_LINKED: "bg-rose-500",
  MAKAM: "bg-sky-500",
  ELIGIBILITY: "bg-purple-500",
};

function emptyAlloc(): Record<TrackType, number> {
  return Object.fromEntries(TRACKS.map((t) => [t.type, 0])) as Record<
    TrackType,
    number
  >;
}

function emptyTerms(): Record<TrackType, number | ""> {
  return Object.fromEntries(TRACKS.map((t) => [t.type, ""])) as Record<
    TrackType,
    number | ""
  >;
}

function allocFromResult(r: MixResult): Record<TrackType, number> {
  const a = emptyAlloc();
  for (const leg of r.legs) a[leg.type] = leg.pct;
  return a;
}

function sameAlloc(
  a: Record<TrackType, number>,
  r: MixResult | null | undefined,
): boolean {
  if (!r) return false;
  const b = allocFromResult(r);
  return TRACKS.every((t) => (a[t.type] ?? 0) === (b[t.type] ?? 0));
}

function CompositionBar({ legs }: { legs: MixResult["legs"] }) {
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      {legs.map((l) => (
        <div
          key={l.type}
          className={TRACK_COLORS[l.type]}
          style={{ width: `${l.pct}%` }}
          title={`${l.label} ${l.pct}%`}
        />
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}

function MixCard({
  title,
  subtitle,
  result,
  active,
  onUse,
}: {
  title: string;
  subtitle: string;
  result: MixResult | null;
  active: boolean;
  onUse: () => void;
}) {
  if (!result) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-400">
        {title} — לא נמצא תמהיל חוקי
      </div>
    );
  }
  return (
    <div
      className={`flex flex-col rounded-xl border bg-white p-4 transition ${
        active ? "border-blue-400 ring-1 ring-blue-200" : "border-slate-200"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <span className="text-xs text-slate-400">{subtitle}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="החזר חודשי" value={formatCurrency(result.firstPayment)} />
        <Stat label="עלות כוללת" value={formatCurrency(result.totalPaid)} />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        בתרחיש לחץ (שנה 5):{" "}
        <span className="font-semibold text-slate-700 tabular-nums">
          {formatCurrency(result.stressedPayment)}
        </span>
      </p>
      <div className="mt-3">
        <CompositionBar legs={result.legs} />
        <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
          {result.legs.map((l) => (
            <li key={l.type} className="flex justify-between">
              <span>{l.label}</span>
              <span className="font-medium tabular-nums">{l.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-auto pt-4">
        <button
          onClick={onUse}
          disabled={active}
          className={`inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
            active
              ? "border-transparent bg-blue-600 text-white"
              : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
          }`}
        >
          {active && <Check className="h-4 w-4" aria-hidden="true" />}
          {active ? "בשימוש בבונה התמהילים" : "השתמש בתמהיל זה"}
        </button>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  suffix,
  step,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
  suffix?: string;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <span className="mt-1 flex items-center rounded-lg border border-slate-300 px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
        <input
          type="number"
          dir="ltr"
          step={step}
          value={value}
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Number(e.target.value))
          }
          className="w-full bg-transparent py-2 text-sm outline-none"
        />
        {suffix && <span className="text-sm text-slate-400">{suffix}</span>}
      </span>
    </label>
  );
}

export function Simulator({
  initialAmount,
  caseId,
  caseName,
  initialIncome,
  initialObligations,
  initialPropertyValue,
  initialLtvBasis,
  initialRates,
  initialCpi,
}: {
  initialAmount: number;
  caseId?: string;
  caseName?: string;
  initialIncome?: number;
  initialObligations?: number;
  initialPropertyValue?: number;
  initialLtvBasis?: LtvBasis;
  initialRates?: RateMap;
  initialCpi?: number;
}) {
  const [amount, setAmount] = useState<number | "">(initialAmount);
  const [years, setYears] = useState<number | "">(25);
  const [income, setIncome] = useState<number | "">(initialIncome ?? "");
  const [obligations, setObligations] = useState<number | "">(
    initialObligations ?? "",
  );
  const [propertyValue, setPropertyValue] = useState<number | "">(
    initialPropertyValue ?? "",
  );
  const [ltvBasis, setLtvBasis] = useState<LtvBasis>(
    initialLtvBasis ?? "FIRST_HOME",
  );
  const [cpi, setCpi] = useState<number | "">(initialCpi ?? DEFAULT_CPI);
  const [rates, setRates] = useState<RateMap>(initialRates ?? defaultRates());
  const [alloc, setAlloc] = useState<Record<TrackType, number>>({
    ...emptyAlloc(),
    PRIME: 30,
    FIXED_UNLINKED: 35,
    FIXED_LINKED: 35,
  });
  // Per-track term (years); "" = the global term.
  const [termYears, setTermYears] = useState<Record<TrackType, number | "">>(
    emptyTerms(),
  );

  const amountN = typeof amount === "number" ? amount : 0;
  const termMonths = Math.min(
    MAX_TERM_MONTHS,
    (typeof years === "number" ? years : 0) * 12,
  );
  const cpiN = typeof cpi === "number" ? cpi : 0;

  const terms = useMemo<TermMap>(() => {
    const t: TermMap = {};
    for (const [type, y] of Object.entries(termYears)) {
      if (typeof y === "number" && y > 0) {
        t[type as TrackType] = Math.min(MAX_TERM_MONTHS, y * 12);
      }
    }
    return t;
  }, [termYears]);

  const constraints = useMemo<MixConstraints>(
    () => ({
      monthlyIncome: typeof income === "number" ? income : undefined,
      monthlyObligations:
        typeof obligations === "number" ? obligations : undefined,
      propertyValue:
        typeof propertyValue === "number" && propertyValue > 0
          ? propertyValue
          : undefined,
      ltvBasis,
      terms,
    }),
    [income, obligations, propertyValue, ltvBasis, terms],
  );

  const opt = useMemo(() => {
    if (amountN <= 0 || termMonths <= 0) return null;
    return optimize({
      amount: amountN,
      termMonths,
      rates,
      cpi: cpiN,
      constraints,
    });
  }, [amountN, termMonths, rates, cpiN, constraints]);

  const allocSum = Object.values(alloc).reduce((s, v) => s + v, 0);
  const manual = useMemo<MixResult | null>(() => {
    if (amountN <= 0 || termMonths <= 0 || Math.round(allocSum) !== 100) {
      return null;
    }
    return evaluateMix(
      alloc as AllocMap,
      amountN,
      termMonths,
      rates,
      cpiN,
      constraints,
    );
  }, [alloc, allocSum, amountN, termMonths, rates, cpiN, constraints]);

  const ltvCapPct = Math.round(LTV_CAPS[ltvBasis] * 100);

  const [saving, startSaving] = useTransition();
  function handleSave() {
    if (!caseId || !manual) return;
    const legs = manual.legs.map((l) => ({
      type: l.type,
      pct: l.pct,
      rate: l.rate,
      termMonths: l.termMonths,
    }));
    const maxTerm = Math.max(...legs.map((l) => l.termMonths));
    startSaving(() =>
      saveScenario({
        caseId,
        amount: amountN,
        termMonths: maxTerm,
        cpi: cpiN,
        firstPayment: manual.firstPayment,
        totalPaid: manual.totalPaid,
        feasible: manual.feasible,
        legs,
      }),
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">סימולטור משכנתאות</h1>
        <p className="mt-1 text-sm text-slate-500">
          {caseName && (
            <>
              <span className="font-semibold text-blue-600">
                תיק: {caseName}
              </span>
              {" · "}
            </>
          )}
          האלגוריתם בוחן את כל התמהילים החוקיים ({opt?.evaluated ?? 0} שילובים)
          לפי כללי בנק ישראל ובוחר את המומלצים.
        </p>
      </div>

      {/* Inputs */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <NumField label="סכום הלוואה" value={amount} onChange={setAmount} suffix="₪" />
          <NumField label="תקופה" value={years} onChange={setYears} suffix="שנים" />
          <NumField
            label="הכנסה חודשית נטו"
            value={income}
            onChange={setIncome}
            suffix="₪"
          />
          <NumField
            label="התחייבויות חודשיות"
            value={obligations}
            onChange={setObligations}
            suffix="₪"
          />
          <NumField
            label="שווי הנכס"
            value={propertyValue}
            onChange={setPropertyValue}
            suffix="₪"
          />
          <label className="block">
            <span className="block text-sm font-medium text-slate-700">
              פרופיל מימון
            </span>
            <select
              value={ltvBasis}
              onChange={(e) => setLtvBasis(e.target.value as LtvBasis)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              {Object.entries(ltvBasisLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {manual?.ltvPct != null && (
          <p
            className={`mt-3 text-sm font-medium ${
              manual.ltvPct <= ltvCapPct ? "text-green-700" : "text-red-700"
            }`}
          >
            אחוז מימון: {Math.round(manual.ltvPct)}% (תקרה {ltvCapPct}%)
          </p>
        )}

        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-blue-600">
            עריכת ריביות והנחות
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {TRACKS.map((t) => (
              <NumField
                key={t.type}
                label={t.label}
                value={rates[t.type]}
                step={0.1}
                suffix="%"
                onChange={(v) =>
                  setRates((r) => ({ ...r, [t.type]: v === "" ? 0 : v }))
                }
              />
            ))}
            <NumField
              label="הנחת מדד (CPI)"
              value={cpi}
              onChange={setCpi}
              step={0.1}
              suffix="%"
            />
          </div>
        </details>
      </div>

      {/* Recommendations */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900">תמהילים מומלצים</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MixCard
            title="החזר חודשי מינימלי"
            subtitle="payment"
            result={opt?.byPayment ?? null}
            active={sameAlloc(alloc, opt?.byPayment)}
            onUse={() => opt?.byPayment && setAlloc(allocFromResult(opt.byPayment))}
          />
          <MixCard
            title="עלות כוללת מינימלית"
            subtitle="cost"
            result={opt?.byCost ?? null}
            active={sameAlloc(alloc, opt?.byCost)}
            onUse={() => opt?.byCost && setAlloc(allocFromResult(opt.byCost))}
          />
          <MixCard
            title="סיכון מינימלי"
            subtitle="risk"
            result={opt?.byRisk ?? null}
            active={sameAlloc(alloc, opt?.byRisk)}
            onUse={() => opt?.byRisk && setAlloc(allocFromResult(opt.byRisk))}
          />
          <MixCard
            title="מאוזן"
            subtitle="balanced"
            result={opt?.balanced ?? null}
            active={sameAlloc(alloc, opt?.balanced)}
            onUse={() => opt?.balanced && setAlloc(allocFromResult(opt.balanced))}
          />
        </div>
      </div>

      {/* Manual builder */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">בניית תמהיל ידנית</h2>
          <span
            className={`text-sm font-semibold tabular-nums ${
              Math.round(allocSum) === 100 ? "text-green-600" : "text-amber-600"
            }`}
          >
            סה״כ {allocSum}%
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TRACKS.map((t) => (
            <div key={t.type} className="flex items-end gap-2">
              <div className="flex-1">
                <NumField
                  label={t.label}
                  value={alloc[t.type]}
                  suffix="%"
                  onChange={(v) =>
                    setAlloc((a) => ({ ...a, [t.type]: v === "" ? 0 : v }))
                  }
                />
              </div>
              <div className="w-24">
                <NumField
                  label="תקופה"
                  value={termYears[t.type]}
                  suffix="שנ׳"
                  onChange={(v) =>
                    setTermYears((m) => ({ ...m, [t.type]: v }))
                  }
                />
              </div>
            </div>
          ))}
        </div>

        {manual ? (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <Stat label="החזר חודשי" value={formatCurrency(manual.firstPayment)} />
              <Stat
                label="תרחיש לחץ (שנה 5)"
                value={formatCurrency(manual.stressedPayment)}
              />
              <Stat label="עלות כוללת" value={formatCurrency(manual.totalPaid)} />
              <Stat label="עלות מימון" value={formatCurrency(manual.financingCost)} />
              <div>
                <p className="text-xs text-slate-500">תאימות לרגולציה</p>
                <p
                  className={`text-lg font-bold ${
                    manual.feasible ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {manual.feasible ? "תקין" : "חריגה"}
                </p>
              </div>
            </div>

            {!manual.feasible && (
              <ul className="space-y-1 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {manual.violations.map((v) => (
                  <li key={v} className="flex items-center gap-2">
                    <AlertTriangle
                      className="h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    {v}
                  </li>
                ))}
              </ul>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">מסלול</th>
                    <th className="px-3 py-2 font-medium">חלק</th>
                    <th className="px-3 py-2 font-medium">סכום</th>
                    <th className="px-3 py-2 font-medium">ריבית</th>
                    <th className="px-3 py-2 font-medium">תקופה</th>
                    <th className="px-3 py-2 font-medium">החזר חודשי</th>
                  </tr>
                </thead>
                <tbody>
                  {manual.legs.map((l) => (
                    <tr key={l.type} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-800">{l.label}</td>
                      <td className="px-3 py-2 text-slate-600 tabular-nums">
                        {l.pct}%
                      </td>
                      <td className="px-3 py-2 text-slate-600 tabular-nums">
                        {formatCurrency(l.amount)}
                      </td>
                      <td className="px-3 py-2 text-slate-600 tabular-nums" dir="ltr">
                        {l.rate}%
                      </td>
                      <td className="px-3 py-2 text-slate-600 tabular-nums">
                        {Math.round(l.termMonths / 12)} שנים
                      </td>
                      <td className="px-3 py-2 text-slate-600 tabular-nums">
                        {formatCurrency(l.firstPayment)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {caseId && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {saving ? "שומר..." : "שמור תמהיל לתיק"}
              </button>
            )}
          </div>
        ) : (
          <p className="mt-5 text-sm text-amber-600">
            השלם את התמהיל ל-100% כדי לראות תוצאות.
          </p>
        )}
      </div>

      <p className="text-xs text-slate-400">
        כללי בנק ישראל: לפחות ⅓ במסלול קבוע, עד ⅔ בפריים, החזר + התחייבויות עד
        50% מההכנסה, מימון עד {ltvCapPct}% לפי הפרופיל. תרחיש לחץ: ריבית משתנה
        +2%, מדד +1.5%, החזר בשנה 5 (אומדן — ללא שערוך מלא במועדי עדכון).
      </p>
    </div>
  );
}
