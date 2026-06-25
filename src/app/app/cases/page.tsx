import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  casePurposeLabel,
  caseStatusLabel,
  caseStatusOrder,
} from "@/lib/labels";
import { formatCurrency } from "@/lib/format";

export default async function CasesPage() {
  const { organizationId } = await requireUser();
  const cases = await prisma.case.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: { contact: { select: { name: true } } },
  });

  const columns = caseStatusOrder.map((status) => ({
    status,
    items: cases.filter((c) => c.status === status),
  }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">תיקי משכנתא</h1>
        <span className="text-sm text-slate-500">{cases.length} תיקים</span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        תיק חדש נפתח מתוך כרטיס לקוח. כדי לשנות סטטוס, היכנס לתיק.
      </p>

      <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div key={col.status} className="w-72 shrink-0">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-slate-700">
                {caseStatusLabel[col.status]}
              </h2>
              <span className="text-xs text-slate-400">{col.items.length}</span>
            </div>
            <div className="mt-2 space-y-2">
              {col.items.map((c) => (
                <Link
                  key={c.id}
                  href={`/app/cases/${c.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-3 transition hover:shadow-sm"
                >
                  <p className="text-sm font-medium text-slate-900">
                    {c.contact.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {c.title ?? casePurposeLabel[c.purpose]}
                  </p>
                  <p className="mt-2 text-xs font-medium text-slate-600">
                    {formatCurrency(c.amount)}
                  </p>
                </Link>
              ))}
              {col.items.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-300">
                  —
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
