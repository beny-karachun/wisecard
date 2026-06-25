import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { PrintButton } from "@/components/print-button";
import {
  blendedMilestones,
  TRACK_BY_TYPE,
  type StoredLeg,
} from "@/lib/mortgage/engine";
import { casePurposeLabel } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/format";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-base font-bold">{value}</p>
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
      case: {
        select: {
          title: true,
          purpose: true,
          contact: { select: { name: true, phone: true } },
        },
      },
    },
  });
  if (!scenario) notFound();

  const legs = scenario.legs as unknown as StoredLeg[];
  const years = Math.round(scenario.termMonths / 12);
  const financingCost = scenario.totalPaid - scenario.amount;

  let primePct = 0;
  let fixedPct = 0;
  for (const l of legs) {
    const def = TRACK_BY_TYPE[l.type];
    if (def.isPrime) primePct += l.pct;
    if (def.fixed) fixedPct += l.pct;
  }

  const milestones = blendedMilestones(
    legs,
    scenario.amount,
    scenario.termMonths,
    scenario.cpi,
  );
  const pickYears = [1, 5, 10, 15, 20, 25, 30].filter((y) => y < years);
  pickYears.push(years);
  const shown = milestones.filter((m) => pickYears.includes(m.year));

  return (
    <main className="mx-auto max-w-3xl bg-white p-8 text-slate-900">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-xl font-bold">{scenario.organization.name}</p>
          <p className="text-sm text-slate-500">דוח סימולציית משכנתא</p>
        </div>
        <p className="text-sm text-slate-500">{formatDate(scenario.createdAt)}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 p-4">
        <div>
          <p className="text-xs text-slate-500">לקוח</p>
          <p className="font-semibold">{scenario.case.contact.name}</p>
          {scenario.case.contact.phone && (
            <p className="text-sm text-slate-500" dir="ltr">
              {scenario.case.contact.phone}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-slate-500">מטרה</p>
          <p className="font-semibold">
            {scenario.case.title ?? casePurposeLabel[scenario.case.purpose]}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="סכום הלוואה" value={formatCurrency(scenario.amount)} />
        <Stat label="תקופה" value={`${years} שנים`} />
        <Stat label="החזר חודשי" value={formatCurrency(scenario.firstPayment)} />
        <Stat label="עלות כוללת" value={formatCurrency(scenario.totalPaid)} />
      </div>

      <h2 className="mt-8 text-lg font-semibold">תמהיל</h2>
      <table className="mt-2 w-full text-right text-sm">
        <thead className="border-b border-slate-200 text-xs text-slate-500">
          <tr>
            <th className="py-2 font-medium">מסלול</th>
            <th className="font-medium">חלק</th>
            <th className="font-medium">סכום</th>
            <th className="font-medium">ריבית</th>
          </tr>
        </thead>
        <tbody>
          {legs.map((l) => (
            <tr key={l.type} className="border-b border-slate-100">
              <td className="py-2">{TRACK_BY_TYPE[l.type].label}</td>
              <td>{l.pct}%</td>
              <td>{formatCurrency((scenario.amount * l.pct) / 100)}</td>
              <td dir="ltr">{l.rate}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 rounded-lg border border-slate-200 p-3 text-sm">
        <p>
          מסלול קבוע: <b>{Math.round(fixedPct)}%</b> (נדרש ≥ ⅓) · פריים:{" "}
          <b>{Math.round(primePct)}%</b> (מותר ≤ ⅔) · עלות מימון:{" "}
          <b>{formatCurrency(financingCost)}</b>
        </p>
        <p className={scenario.feasible ? "text-green-700" : "text-red-700"}>
          {scenario.feasible
            ? "✓ עומד בכללי בנק ישראל"
            : "✗ חריגה מכללי בנק ישראל"}
        </p>
      </div>

      <h2 className="mt-8 text-lg font-semibold">החזר לאורך זמן</h2>
      <table className="mt-2 w-full text-right text-sm">
        <thead className="border-b border-slate-200 text-xs text-slate-500">
          <tr>
            <th className="py-2 font-medium">שנה</th>
            <th className="font-medium">החזר חודשי</th>
            <th className="font-medium">יתרה</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((m) => (
            <tr key={m.year} className="border-b border-slate-100">
              <td className="py-2">{m.year}</td>
              <td>{formatCurrency(m.payment)}</td>
              <td>{formatCurrency(m.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-8 text-xs text-slate-400">
        הדוח להמחשה בלבד ואינו מהווה הצעה או התחייבות. החישוב מבוסס על הריביות
        והמדד שהוזנו, בהנחת קבועים לאורך התקופה.
      </p>

      <div className="mt-6 flex gap-3 no-print">
        <PrintButton />
        <Link
          href="/app/cases"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          חזרה
        </Link>
      </div>
    </main>
  );
}
