import type { Borrower, Property } from "@prisma/client";
import {
  createBorrower,
  deleteBorrower,
  updateBorrower,
  upsertProperty,
} from "@/app/app/actions";
import {
  employmentLabel,
  ltvBasisLabel,
  propertyTypeLabel,
} from "@/lib/labels";
import { LTV_CAPS, PTI_MAX } from "@/lib/mortgage/tracks";
import { formatCurrency } from "@/lib/format";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";

function SummaryChip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "bad";
}) {
  const toneCls =
    tone === "good"
      ? "text-green-700"
      : tone === "bad"
        ? "text-red-700"
        : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm font-bold ${toneCls}`}>{value}</p>
    </div>
  );
}

function BorrowerFields({ borrower }: { borrower?: Borrower }) {
  return (
    <>
      <input
        name="name"
        required
        defaultValue={borrower?.name}
        placeholder="שם הלווה"
        className={`${inputCls} min-w-28 flex-1`}
      />
      <label className="block">
        <span className="text-xs text-slate-500">הכנסה נטו</span>
        <input
          name="monthlyIncome"
          type="number"
          min={0}
          dir="ltr"
          defaultValue={borrower?.monthlyIncome ?? ""}
          placeholder="₪"
          className={`${inputCls} w-24`}
        />
      </label>
      <label className="block">
        <span className="text-xs text-slate-500">התחייבויות</span>
        <input
          name="monthlyObligations"
          type="number"
          min={0}
          dir="ltr"
          defaultValue={borrower?.monthlyObligations ?? ""}
          placeholder="₪"
          className={`${inputCls} w-24`}
        />
      </label>
      <label className="block">
        <span className="text-xs text-slate-500">תעסוקה</span>
        <select
          name="employment"
          defaultValue={borrower?.employment ?? "SALARIED"}
          className={`${inputCls} bg-white`}
        >
          {Object.entries(employmentLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

export function CaseFinances({
  caseId,
  loanAmount,
  borrowers,
  property,
}: {
  caseId: string;
  loanAmount: number | null;
  borrowers: Borrower[];
  property: Property | null;
}) {
  const income = borrowers.reduce((s, b) => s + b.monthlyIncome, 0);
  const obligations = borrowers.reduce((s, b) => s + b.monthlyObligations, 0);
  const capacity = Math.max(0, income * PTI_MAX - obligations);

  const ltvCap = property ? LTV_CAPS[property.ltvBasis] : null;
  const ltv =
    property && loanAmount && property.value > 0
      ? loanAmount / property.value
      : null;

  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900">לווים ונכס</h2>

      {(income > 0 || ltv != null) && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryChip label="הכנסה נטו למשק בית" value={formatCurrency(income)} />
          <SummaryChip label="התחייבויות קיימות" value={formatCurrency(obligations)} />
          <SummaryChip
            label="יכולת החזר (עד 50%)"
            value={formatCurrency(Math.round(capacity))}
          />
          {ltv != null && ltvCap != null && (
            <SummaryChip
              label={`מימון (תקרה ${Math.round(ltvCap * 100)}%)`}
              value={`${Math.round(ltv * 100)}%`}
              tone={ltv <= ltvCap ? "good" : "bad"}
            />
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Borrowers */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-700">לווים</h3>
          <div className="mt-3 space-y-3">
            {borrowers.map((b) => (
              <form
                key={b.id}
                action={updateBorrower}
                className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2"
              >
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="caseId" value={caseId} />
                <BorrowerFields borrower={b} />
                <button
                  type="submit"
                  className="rounded-lg border border-indigo-200 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                >
                  עדכן
                </button>
                <button
                  formAction={deleteBorrower.bind(null, b.id)}
                  className="px-1 py-1.5 text-xs text-red-600 hover:underline"
                >
                  מחק
                </button>
              </form>
            ))}

            <form
              action={createBorrower}
              className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3"
            >
              <input type="hidden" name="caseId" value={caseId} />
              <BorrowerFields />
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                הוסף לווה
              </button>
            </form>
          </div>
        </div>

        {/* Property */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-700">הנכס</h3>
          <form action={upsertProperty} className="mt-3 space-y-3">
            <input type="hidden" name="caseId" value={caseId} />
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-slate-500">שווי הנכס (₪)</span>
                <input
                  name="value"
                  type="number"
                  min={1}
                  required
                  dir="ltr"
                  defaultValue={property?.value ?? ""}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">עיר</span>
                <input
                  name="city"
                  defaultValue={property?.city ?? ""}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">סוג נכס</span>
                <select
                  name="type"
                  defaultValue={property?.type ?? "APARTMENT"}
                  className={`${inputCls} bg-white`}
                >
                  {Object.entries(propertyTypeLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">פרופיל מימון</span>
                <select
                  name="ltvBasis"
                  defaultValue={property?.ltvBasis ?? "FIRST_HOME"}
                  className={`${inputCls} bg-white`}
                >
                  {Object.entries(ltvBasisLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              {property ? "עדכן נכס" : "שמור נכס"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
