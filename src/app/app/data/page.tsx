import { requireUser } from "@/lib/session";
import {
  getCpiHistory,
  getMarketSnapshot,
  PRIME_SPREAD,
} from "@/lib/market/sync";
import { RefreshButton } from "@/components/refresh-button";
import { formatDate, formatDateTime, formatMonth } from "@/lib/format";

export default async function DataCenterPage() {
  await requireUser();
  const [snap, cpiHist] = await Promise.all([
    getMarketSnapshot(),
    getCpiHistory(12),
  ]);

  const cards = [
    { label: "ריבית בנק ישראל", value: snap.boiRate, date: snap.boiDate, suffix: "%" },
    {
      label: `ריבית פריים (בנק ישראל + ${PRIME_SPREAD})`,
      value: snap.prime,
      date: snap.boiDate,
      suffix: "%",
    },
    { label: "אינפלציה שנתית", value: snap.cpiYoY, date: snap.cpiDate, suffix: "%" },
    { label: "מדד המחירים לצרכן", value: snap.cpiIndex, date: snap.cpiDate, suffix: "" },
  ];

  const hasData = snap.boiRate != null || snap.cpiYoY != null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">מרכז נתונים פיננסי</h1>
          <p className="mt-1 text-sm text-slate-500">
            נתוני אמת מבנק ישראל והלשכה המרכזית לסטטיסטיקה.
            {snap.updatedAt && ` עודכן: ${formatDateTime(snap.updatedAt)}`}
          </p>
        </div>
        <RefreshButton />
      </div>

      {!hasData ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
          אין נתונים עדיין. לחץ &quot;עדכן נתונים&quot; כדי למשוך מבנק ישראל
          והלמ״ס.
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {cards.map((c) => (
              <div
                key={c.label}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <p className="text-2xl font-bold text-slate-900">
                  {c.value != null ? `${c.value}${c.suffix}` : "—"}
                </p>
                <p className="mt-1 text-xs text-slate-500">{c.label}</p>
                {c.date && (
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDate(c.date)}
                  </p>
                )}
              </div>
            ))}
          </div>

          <h2 className="mt-10 text-lg font-semibold text-slate-900">
            מדד המחירים לצרכן — 12 חודשים אחרונים
          </h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-right text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">חודש</th>
                  <th className="px-4 py-2 font-medium">מדד</th>
                  <th className="px-4 py-2 font-medium">שינוי שנתי</th>
                </tr>
              </thead>
              <tbody>
                {cpiHist.map((r) => (
                  <tr
                    key={r.date.toISOString()}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-4 py-2 text-slate-700">
                      {formatMonth(r.date)}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{r.index ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {r.yoy != null ? `${r.yoy}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="mt-8 text-xs text-slate-400">
        מקורות: בנק ישראל (Edge API), הלשכה המרכזית לסטטיסטיקה. ניתן לתזמן עדכון
        יומי דרך ‎/api/cron/sync‎. הריבית מזינה את הסימולטור אוטומטית.
      </p>
    </div>
  );
}
