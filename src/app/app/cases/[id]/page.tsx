import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Calculator, FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { StatusSelect } from "@/components/status-select";
import { ActivityTimeline } from "@/components/activity-timeline";
import { AddActivityForm } from "@/components/add-activity-form";
import { AddTaskForm } from "@/components/add-task-form";
import { CaseFinances } from "@/components/case-finances";
import { SubmitButton } from "@/components/submit-button";
import { TaskToggle } from "@/components/task-toggle";
import { casePurposeLabel } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/format";
import { deleteCase, deleteScenario } from "@/app/app/actions";

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
      scenarios: { orderBy: { createdAt: "desc" } },
      borrowers: { orderBy: { createdAt: "asc" } },
      property: true,
    },
  });
  if (!kase) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/app/cases"
            className="inline-flex items-center gap-1 text-sm text-slate-400 transition hover:text-slate-600"
          >
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            תיקי משכנתא
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {kase.title ?? casePurposeLabel[kase.purpose]}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            לקוח:{" "}
            <Link
              href={`/app/contacts/${kase.contact.id}`}
              className="text-blue-600 hover:underline"
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
            href={`/app/simulator?amount=${kase.amount ?? ""}&caseId=${kase.id}`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            <Calculator className="h-4 w-4" aria-hidden="true" />
            פתח בסימולטור
          </Link>
        </div>
      </div>

      <CaseFinances
        caseId={kase.id}
        loanAmount={kase.amount}
        borrowers={kase.borrowers}
        property={kase.property}
      />

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
                  <TaskToggle id={t.id} done={t.done} />
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

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            תמהילים שמורים
          </h2>
          <Link
            href={`/app/simulator?amount=${kase.amount ?? ""}&caseId=${kase.id}`}
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            + תמהיל חדש בסימולטור
          </Link>
        </div>
        {kase.scenarios.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            לא נשמרו תמהילים. בנה תמהיל בסימולטור ושמור אותו לתיק.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {kase.scenarios.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {s.label ?? `תמהיל · ${formatCurrency(s.amount)}`}
                  </p>
                  <p className="text-xs text-slate-500">
                    {Math.round(s.termMonths / 12)} שנים · החזר{" "}
                    {formatCurrency(s.firstPayment)} · עלות{" "}
                    {formatCurrency(s.totalPaid)} · {formatDate(s.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {!s.feasible && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                      חריגה
                    </span>
                  )}
                  <a
                    href={`/report/${s.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
                  >
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    דוח
                  </a>
                  <form action={deleteScenario.bind(null, s.id)}>
                    <SubmitButton
                      variant="danger"
                      confirmMessage="למחוק את התמהיל השמור?"
                    >
                      מחק
                    </SubmitButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <details className="rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-600">
          פעולות
        </summary>
        <form action={deleteCase.bind(null, kase.id)} className="mt-3">
          <SubmitButton
            variant="danger"
            confirmMessage="למחוק את התיק לצמיתות, כולל כל התמהילים והמשימות שלו?"
          >
            מחק תיק
          </SubmitButton>
        </form>
      </details>
    </div>
  );
}
