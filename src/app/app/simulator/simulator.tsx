"use client";

import { useMemo, useState, useTransition } from "react";
import {
  defaultRates,
  evaluateMix,
  optimize,
  TRACKS,
  type AllocMap,
  type MixResult,
  type RateMap,
} from "@/lib/mortgage/engine";
import { DEFAULT_CPI, MAX_TERM_MONTHS, type TrackType } from "@/lib/mortgage/tracks";
import { formatCurrency } from "@/lib/format";
import { saveScenario } from "@/app/app/actions";

const TRACK_COLORS: Record<TrackType, string> = {
  PRIME: "bg-indigo-500",
  FIXED_UNLINKED: "bg-emerald-500",
  FIXED_LINKED: "bg-teal-500",
  VARIABLE_UNLINKED: "bg-amber-500",
  VARIABLE_LINKED: "bg-rose-500",
};

function emptyAlloc(): Record<TrackType, number> {
  return {
    PRIME: 0,
    FIXED_UNLINKED: 0,
    FIXED_LINKED: 0,
    VARIABLE_UNLINKED: 0,
    VARIABLE_LINKED: 0,
  };
}

function allocFromResult(r: MixResult): Record<TrackType, number> {
  const a = emptyAlloc();
  for (const leg of r.legs) a[leg.type] = leg.pct;
  return a;
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
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}

function MixCard({
  title,
  subtitle,
  result,
  onUse,
}: {
  title: string;
  subtitle: string;
  result: MixResult | null;
  onUse: () => void;
}) {
  if (!result) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">
        {title} — לא נמצא תמהיל חוקי
      </div>
    );
  }
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <span className="text-xs text-slate-400">{subtitle}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="החזר חודשי" value={formatCurrency(result.firstPayment)} />
        <Stat label="עלות כוללת" value={formatCurrency(result.totalPaid)} />
      </div>
      <div className="mt-3">
        <CompositionBar legs={result.legs} />
        <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
          {result.legs.map((l) => (
            <li key={l.type} className="flex justify-between">
              <span>{l.label}</span>
              <span className="font-medium">{l.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
      <button
        onClick={onUse}
        className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
      >
        השתמש בתמהיל זה
      </button>
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
      <span className="mt-1 flex items-center rounded-lg border border-slate-300 px-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200">
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
}: {
  initialAmount: number;
  caseId?: string;
}) {
  const [amount, setAmount] = useState<number | "">(initialAmount);
  const [years, setYears] = useState<number | "">(25);
  const [income, setIncome] = useState<number | "">("");
  const [cpi, setCpi] = useState<number | "">(DEFAULT_CPI);
  const [rates, setRates] = useState<RateMap>(defaultRates());
  const [alloc, setAlloc] = useState<Record<TrackType, number>>({
    ...emptyAlloc(),
    PRIME: 30,
    FIXED_UNLINKED: 35,
    FIXED_LINKED: 35,
  });

  const amountN = typeof amount === "number" ? amount : 0;
  const termMonths = Math.min(
    MAX_TERM_MONTHS,
    (typeof years === "number" ? years : 0) * 12,
  );
  const cpiN = typeof cpi === "number" ? cpi : 0;
  const incomeN = typeof income === "number" ? income : undefined;

  const opt = useMemo(() => {
    if (amountN <= 0 || termMonths <= 0) return null;
    return optimize({
      amount: amountN,
      termMonths,
      rates,
      cpi: cpiN,
      monthlyIncome: incomeN,
    });
  }, [amountN, termMonths, rates, cpiN, incomeN]);

  const allocSum = Object.values(alloc).reduce((s, v) => s + v, 0);
  const manual = useMemo<MixResult | null>(() => {
    if (amountN <= 0 || termMonths <= 0 || Math.round(allocSum) !== 100) {
      return null;
    }
    return evaluateMix(alloc as AllocMap, amountN, termMonths, rates, cpiN, {
      monthlyIncome: incomeN,
    });
  }, [alloc, allocSum, amountN, termMonths, rates, cpiN, incomeN]);

  const [saving, startSaving] = useTransition();
  function handleSave() {
    if (!caseId || !manual) return;
    const legs = manual.legs.map((l) => ({
      type: l.type,
      pct: l.pct,
      rate: l.rate,
    }));
    startSaving(() =>
      saveScenario({
        caseId,
        amount: amountN,
        termMonths,
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
            label="הכנסה חודשית (לבדיקת החזר)"
            value={income}
            onChange={setIncome}
            suffix="₪"
          />
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-indigo-600">
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
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <MixCard
            title="החזר חודשי מינימלי"
            subtitle="payment"
            result={opt?.byPayment ?? null}
            onUse={() => opt?.byPayment && setAlloc(allocFromResult(opt.byPayment))}
          />
          <MixCard
            title="עלות כוללת מינימלית"
            subtitle="cost"
            result={opt?.byCost ?? null}
            onUse={() => opt?.byCost && setAlloc(allocFromResult(opt.byCost))}
          />
          <MixCard
            title="מאוזן"
            subtitle="balanced"
            result={opt?.balanced ?? null}
            onUse={() => opt?.balanced && setAlloc(allocFromResult(opt.balanced))}
          />
        </div>
      </div>

      {/* Manual builder */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">בניית תמהיל ידנית</h2>
          <span
            className={`text-sm font-semibold ${
              Math.round(allocSum) === 100 ? "text-green-600" : "text-amber-600"
            }`}
          >
            סה״כ {allocSum}%
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TRACKS.map((t) => (
            <NumField
              key={t.type}
              label={t.label}
              value={alloc[t.type]}
              suffix="%"
              onChange={(v) =>
                setAlloc((a) => ({ ...a, [t.type]: v === "" ? 0 : v }))
              }
            />
          ))}
        </div>

        {manual ? (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="החזר חודשי" value={formatCurrency(manual.firstPayment)} />
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
              <ul className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {manual.violations.map((v) => (
                  <li key={v}>• {v}</li>
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
                    <th className="px-3 py-2 font-medium">החזר חודשי</th>
                  </tr>
                </thead>
                <tbody>
                  {manual.legs.map((l) => (
                    <tr key={l.type} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-800">{l.label}</td>
                      <td className="px-3 py-2 text-slate-600">{l.pct}%</td>
                      <td className="px-3 py-2 text-slate-600">
                        {formatCurrency(l.amount)}
                      </td>
                      <td className="px-3 py-2 text-slate-600" dir="ltr">
                        {l.rate}%
                      </td>
                      <td className="px-3 py-2 text-slate-600">
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
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
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
        כללי בנק ישראל: לפחות ⅓ במסלול קבוע, עד ⅔ בפריים, החזר עד 50% מההכנסה.
        החישוב מניח ריביות ומדד קבועים לאורך התקופה (אומדן; נתוני אמת ב-Phase 3).
      </p>
    </div>
  );
}
