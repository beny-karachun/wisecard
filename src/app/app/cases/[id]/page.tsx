import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { StatusSelect } from "@/components/status-select";
import { ActivityTimeline } from "@/components/activity-timeline";
import { AddActivityForm } from "@/components/add-activity-form";
import { AddTaskForm } from "@/components/add-task-form";
import { casePurposeLabel } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/format";
import { deleteCase, toggleTask } from "@/app/app/actions";

export default async function CaseDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organizationId } = await requireUser();

  const kase = await prisma.case.findFirst({
    where: { id, organizationId },
    include: {
      contact: { select: { id: true, name: true } },
      tasks: {
        orderBy: [{ done: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      },
      activities: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true, email: true } } },
      },
    },
  });
  if (!kase) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/app/cases"
            className="text-sm text-slate-400 hover:underline"
          >
            ← תיקי משכנתא
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {kase.title ?? casePurposeLabel[kase.purpose]}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            לקוח:{" "}
            <Link
              href={`/app/contacts/${kase.contact.id}`}
              className="text-indigo-600 hover:underline"
            >
              {kase.contact.name}
            </Link>
            {" · "}
            {casePurposeLabel[kase.purpose]}
            {" · "}
            {formatCurrency(kase.amount)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusSelect caseId={kase.id} status={kase.status} />
          <Link
            href={`/app/simulator?amount=${kase.amount ?? ""}`}
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            פתח בסימולטור ←
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">משימות</h2>
          <div className="mt-3">
            <AddTaskForm caseId={kase.id} />
          </div>
          <ul className="mt-4 space-y-2">
            {kase.tasks.length === 0 ? (
              <p className="text-sm text-slate-400">אין משימות.</p>
            ) : (
              kase.tasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
                >
                  <form action={toggleTask.bind(null, t.id)}>
                    <button
                      type="submit"
                      aria-label="סמן כבוצע"
                      className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
                        t.done
                          ? "border-green-600 bg-green-600 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {t.done ? "✓" : ""}
                    </button>
                  </form>
                  <span
                    className={`flex-1 text-sm ${
                      t.done ? "text-slate-400 line-through" : "text-slate-800"
                    }`}
                  >
                    {t.title}
                  </span>
                  {t.dueAt && (
                    <span className="text-xs text-slate-400">
                      {formatDate(t.dueAt)}
                    </span>
                  )}
                </li>
              ))
            )}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">פעילות</h2>
          <div className="mt-3">
            <AddActivityForm caseId={kase.id} />
          </div>
          <div className="mt-4">
            <ActivityTimeline activities={kase.activities} />
          </div>
        </section>
      </div>

      <details className="rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-600">
          פעולות
        </summary>
        <form action={deleteCase.bind(null, kase.id)} className="mt-3">
          <button
            type="submit"
            className="text-sm font-medium text-red-600 hover:underline"
          >
            מחק תיק
          </button>
        </form>
      </details>
    </div>
  );
}
