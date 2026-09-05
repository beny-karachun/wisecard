import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatCurrency } from "@/lib/format";
import { caseStatusLabel } from "@/lib/labels";
import { PageHeading, Badge, Empty } from "@/components/workspace/ui";

export default async function FeesPage() {
  const { organizationId } = await requireUser();
  const cases = await prisma.case.findMany({
    where: { organizationId, status: { not: "LOST" } },
    include: { contact: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const total = cases.reduce((s, c) => s + c.feeAgreed, 0),
    paid = cases.reduce((s, c) => s + c.feePaid, 0);
  return (
    <div className="workspace">
      <PageHeading
        title="שכר טרחה וגבייה"
        description="מעקב אחר הסכומים שסוכמו ושולמו בכל תיק. תיקים שסומנו כאבודים אינם נכללים בסיכום."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          ["שכר טרחה מוסכם", total],
          ["שולם", paid],
          ["יתרה לגבייה", total - paid],
        ].map(([label, amount]) => (
          <div className="panel" key={label}>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-3 text-3xl font-bold">
              {formatCurrency(Number(amount))}
            </p>
          </div>
        ))}
      </div>
      <p className="mb-5 text-xs text-slate-500">
        הסכומים מוצגים כפי שהוזנו. יש לשמור על בסיס מס אחיד; המערכת אינה מפיקה
        חשבוניות.
      </p>
      {!cases.length ? (
        <Empty
          title="אין תיקים להצגה"
          description="שכר הטרחה מתעדכן מתוך פרטי תיק המשכנתא."
        />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[600px] text-right text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                {["לקוח", "שלב", "סוכם", "שולם", "יתרה", ""].map((t, i) => (
                  <th className="px-3 py-3 font-medium" key={i}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="px-3 py-4 font-semibold">
                    {c.contact.name}
                    <p className="mt-1 text-xs font-normal text-slate-500">
                      {c.title}
                    </p>
                  </td>
                  <td className="px-3 py-4">
                    <Badge>{caseStatusLabel[c.status]}</Badge>
                  </td>
                  <td className="px-3 py-4">{formatCurrency(c.feeAgreed)}</td>
                  <td className="px-3 py-4">{formatCurrency(c.feePaid)}</td>
                  <td className="px-3 py-4 font-semibold">
                    {formatCurrency(c.feeAgreed - c.feePaid)}
                  </td>
                  <td className="px-3 py-4">
                    <Link
                      href={`/app/cases/${c.id}#management`}
                      className="text-teal-700"
                    >
                      עדכון בתיק ←
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
