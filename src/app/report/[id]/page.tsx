import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { PrintButton } from "@/components/print-button";
import { simulate, annualMilestones } from "@/lib/mortgage/engine";
import { readSnapshot } from "@/lib/mortgage/snapshot";
import { RULES_SOURCE, RULES_REVIEWED_ON } from "@/lib/mortgage/tracks";
import { ltvBasisLabel } from "@/lib/labels";
import { formatCurrency as money, formatDate } from "@/lib/format";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}
export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organizationId } = await requireUser();
  const scenario = await prisma.scenario.findFirst({
    where: { id, organizationId },
    include: {
      organization: { select: { name: true } },
      case: { select: { title: true, contact: { select: { name: true } } } },
    },
  });
  if (!scenario) notFound();
  const input = readSnapshot(scenario.snapshot);
  const sim = input ? simulate(input) : null;
  const r = sim?.result;
  const c = input?.constraints;
  return (
    <main
      dir="rtl"
      className="mx-auto max-w-5xl bg-white p-5 text-slate-900 sm:p-8"
    >
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xl font-bold">{scenario.organization.name}</p>
          <h1 className="mt-2 text-lg font-semibold">
            דוח סימולציית משכנתא · {scenario.label || "תמהיל"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {scenario.case.contact.name} · {scenario.case.title || "תיק משכנתא"}
          </p>
        </div>
        <p className="text-sm text-slate-500">
          נשמר ב־{formatDate(scenario.createdAt)}
        </p>
      </header>
      {!sim && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
          <h2 className="font-bold">תמהיל היסטורי — חישוב לא מאומת</h2>
          <p>
            התמהיל נשמר בגרסה קודמת או ללא צילום הנחות תקין. הסכומים להלן הם
            הערכים ההיסטוריים השמורים; לא מוצגת קביעה לגבי עמידה בכללים ולא צורף
            לוח שחושב במודל אחר. פתחו בסימולטור, בדקו את הנתונים ושמרו עותק חדש
            לקבלת דוח מלא.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="סכום הלוואה"
          value={money(input?.amount ?? scenario.amount)}
        />
        <Stat
          label="תקופה מרבית"
          value={`${r?.termMonths ?? scenario.termMonths} חודשים`}
        />
        <Stat
          label="תשלום הלוואה ראשון"
          value={money(r?.firstPayment ?? scenario.firstPayment)}
        />
        <Stat
          label="סך תשלומי הלוואה"
          value={money(r?.totalPaid ?? scenario.totalPaid)}
        />
      </div>
      {sim && input && r && c && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="סך ריבית" value={money(r.totalInterest)} />
            <Stat label="סך הצמדה" value={money(r.totalIndexation)} />
            <Stat label="סך הוצאה כולל עלויות" value={money(r.totalOutlay)} />
            <Stat
              label={`שיא החזר בבסיס · חודש ${r.peakMonth}`}
              value={money(r.peakPayment)}
            />
          </div>
          <section className="mt-7">
            <h2 className="text-lg font-bold">המסלולים שנשמרו</h2>
            <div className="overflow-x-auto">
              <table className="mt-3 w-full text-right text-sm tabular-nums">
                <thead>
                  <tr className="border-b text-xs text-slate-500">
                    {["מסלול", "חלק", "קרן", "ריבית שנתית", "חודשים"].map(
                      (h) => (
                        <th key={h} className="py-3 font-medium">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {r.legs.map((l) => (
                    <tr key={l.type} className="border-b border-slate-100">
                      <td className="py-3">{l.label}</td>
                      <td>{l.pct}%</td>
                      <td>{money(l.amount)}</td>
                      <td>{l.rate}%</td>
                      <td>{l.termMonths}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="mt-7 break-inside-avoid">
            <h2 className="text-lg font-bold">הנחות החישוב השמורות</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {(
                [
                  ["מדד שנתי", `${input.cpi}%`],
                  ["תאריך בחינת אישור", c.approvalDate || "לא הוזן"],
                  ["הכנסה מוכרת נטו", money(c.monthlyIncome)],
                  [
                    "הוצאות קבועות (ללא דיור להלן)",
                    money(c.monthlyObligations),
                  ],
                  ["הכנסה פנויה לחישוב", money(r.disposableIncome)],
                  [
                    "פרופיל מימון",
                    c.ltvBasis ? ltvBasisLabel[c.ltvBasis] : "לא הוגדר",
                  ],
                  ["שווי נכס", money(c.propertyValue)],
                  ["אשראי שנותר בנכס", money(c.existingHousingBalance)],
                  ["תשלום דיור שנותר בנכס", money(c.existingHousingPayment)],
                  ["יתרה באותו בנק", money(c.sameBankBalance)],
                  ["מתוכה בריבית משתנה", money(c.sameBankVariableBalance)],
                  ["יתרה שממוחזרת", money(c.refinanceBalance)],
                  [
                    "בחינת הקלה לכל מטרה",
                    c.consolidationConcession ? "כן — לשיקול הבנק" : "לא",
                  ],
                  ["ביטוח חודשי קבוע משוער", money(input.monthlyInsurance)],
                  ["עלויות חד־פעמיות", money(input.upfrontCosts)],
                ] as [string, string][]
              ).map(([name, value]) => (
                <div
                  className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-2"
                  key={name}
                >
                  <dt className="text-slate-500">{name}</dt>
                  <dd className="tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="mt-7 break-inside-avoid">
            <h2 className="text-lg font-bold">
              בדיקות בסיסיות לפי הנתונים השמורים
            </h2>
            <p
              className={`mt-2 font-semibold ${r.assessment === "fail" ? "text-red-700" : r.assessment === "incomplete" ? "text-amber-800" : "text-teal-700"}`}
            >
              {r.assessment === "fail"
                ? "נמצאו חריגות"
                : r.assessment === "incomplete"
                  ? "הבדיקה חלקית — נדרשת השלמה או בחינה פרטנית"
                  : "התמהיל עבר את הבדיקות הבסיסיות"}
            </p>
            <p className="mt-2 text-sm">
              יחס החזר התחלתי:{" "}
              {r.ptiPct == null ? "לא נבדק" : `${r.ptiPct.toFixed(1)}%`} · מימון
              כולל: {r.ltvPct == null ? "לא נבדק" : `${r.ltvPct.toFixed(1)}%`} ·
              ריבית משתנה בתמהיל החדש: {r.variablePct.toFixed(2)}%
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6">
              {r.checks.map((check) => (
                <li key={check.key}>
                  <b>
                    {check.label} (
                    {check.status === "pass"
                      ? "נבדק"
                      : check.status === "fail"
                        ? "חריגה"
                        : "להשלמה"}
                    ):{" "}
                  </b>
                  {check.detail}
                </li>
              ))}
              {r.warnings.map((w) => (
                <li key={w} className="text-amber-800">
                  {w}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              הבדיקה אינה אישור רגולטורי או התחייבות להעמדת אשראי. ההכנסה, שווי
              הנכס וההוצאות דורשים הכרה ואימות בבנק.
            </p>
          </section>
          <section className="mt-7 break-inside-avoid">
            <h2 className="text-lg font-bold">תרחיש לחץ</h2>
            <p className="mt-2 text-sm leading-6">
              לאחר חודש {input.stress.afterMonth}: תוספת {input.stress.rateBump}{" "}
              נקודות אחוז לריבית המשתנה, בתחנת השינוי הבאה של המסלול, ותוספת{" "}
              {input.stress.cpiBump} נקודות אחוז למדד השנתי מחודש{" "}
              {input.stress.afterMonth + 1}. תחנות השינוי נמדדות מתחילת ההלוואה;
              ריבית במסלול קבוע אינה משתנה.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat
                label={`החזר בחודש ${r.stressObservationMonth}`}
                value={money(r.stressedPayment)}
              />
              <Stat
                label="שיא החזר לאורך התקופה"
                value={money(r.stressedPeakPayment)}
              />
              <Stat
                label="סך תשלומי הלוואה בלחץ"
                value={money(r.stressedTotalPaid)}
              />
              <Stat
                label={`יחס החזר בחודש ${r.stressObservationMonth}`}
                value={
                  r.stressedPtiPct == null
                    ? "לא נבדק"
                    : `${r.stressedPtiPct.toFixed(1)}%`
                }
              />
            </div>
          </section>
          <section className="mt-7">
            <h2 className="text-lg font-bold">לוח סילוקין · סיכום שנתי</h2>
            <p className="mt-2 text-xs leading-6 text-slate-500">
              התשלומים מסוכמים לתקופה; יתרות בסופה. השנה האחרונה עשויה להיות
              חלקית. לפני ביטוח ועלויות חד־פעמיות; עיגול לתצוגה בלבד.
            </p>
            <table className="mt-3 w-full text-right text-sm tabular-nums">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  {[
                    "חודש",
                    "תשלומי בסיס",
                    "ריבית",
                    "הצמדה",
                    "יתרת בסיס",
                    "יתרה בלחץ",
                  ].map((h) => (
                    <th className="py-3 font-medium" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {annualMilestones(sim.rows).map((row) => (
                  <tr
                    key={row.month}
                    className="break-inside-avoid border-b border-slate-100"
                  >
                    <td className="py-2">{row.month}</td>
                    <td>{money(row.paid)}</td>
                    <td>{money(row.interest)}</td>
                    <td>{money(row.indexation)}</td>
                    <td>{money(row.balance)}</td>
                    <td>{money(sim.stressRows[row.month - 1].balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <footer className="mt-7 space-y-2 border-t border-slate-200 pt-4 text-xs leading-6 text-slate-500">
            <p>
              מודל חישוב 2 · נתוני המשכנתא והבדיקות משוחזרים מההנחות שנשמרו עם
              התמהיל. פרטי המשרד והלקוח בכותרת הם הפרטים הנוכחיים.
            </p>
            <p>
              לוח שפיצר חודשי; ריבית שנתית נומינלית המחולקת ל־12; מדד שנתי
              אפקטיבי הנצבר חודשית על יתרת הפתיחה, מהחודש הראשון. ריביות הבסיס
              קבועות. אין רצפת מדד חוזית, פיגור מדד, תקופה ראשונה חלקית, גרייס,
              בלון או עמלת פירעון מוקדם. הביטוח מוערך כקבוע עד סיום המסלול הארוך
              ביותר. הסכומים הם אומדני תכנון, לא תחזית או הצעת בנק.
            </p>
            <p>
              <a href={RULES_SOURCE} className="underline">
                הוראת בנק ישראל והעדכון לתחולת הכללים
              </a>{" "}
              · נבדקו ב־{RULES_REVIEWED_ON}. אשראי שנותר בנכס נבחן לפי תאריך
              האישור שהוזן; מיחזור, זכאות וחריגים דורשים בדיקה פרטנית.
            </p>
          </footer>
        </>
      )}
      <div className="no-print mt-7 flex flex-wrap gap-3">
        <PrintButton />
        <Link
          href={`/app/simulator?scenarioId=${scenario.id}`}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
        >
          פתיחה בסימולטור
        </Link>
        <Link
          href={`/app/cases/${scenario.caseId}`}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
        >
          חזרה לתיק
        </Link>
      </div>
    </main>
  );
}
