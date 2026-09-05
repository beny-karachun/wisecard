import { readSnapshot } from "@/lib/mortgage/snapshot";
import { simulate } from "@/lib/mortgage/engine";
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
import {
  DocumentsPanel,
  BankOffersPanel,
} from "@/components/workspace/case-panels";
import { CaseWorkflowForm } from "@/components/workspace/forms";
import { Panel, AddSection, Badge } from "@/components/workspace/ui";
import { documentNeedsAttention } from "@/lib/workspace";
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
      documents: { orderBy: { title: "asc" } },
      bankOffers: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!kase) notFound();

  return (
    <div className="workspace space-y-8">
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

      <nav className="flex flex-wrap gap-2" aria-label="ניווט בתיק">
        {[
          ["financials", "לווים ונכס"],
          ["documents", "מסמכים"],
          ["banks", "הצעות בנקים"],
          ["management", "מעקב ושכר טרחה"],
        ].map(([target, label]) => (
          <a key={target} href={`#${target}`} className="button-secondary">
            {label}
          </a>
        ))}
        <Link
          className="button-primary"
          href={`/app/calendar?new=1&caseId=${kase.id}`}
        >
          קביעת פגישה
        </Link>
      </nav>
      <Panel title="מוכנות התיק והשלב הבא">
        <div className="flex flex-wrap gap-2">
          <Badge tone={kase.borrowers.length ? "teal" : "amber"}>
            {kase.borrowers.length
              ? `${kase.borrowers.length} לווים בתיק`
              : "יש להשלים פרטי לווים"}
          </Badge>
          <Badge tone={kase.property ? "teal" : "amber"}>
            {kase.property ? "פרטי נכס הוזנו" : "יש להשלים פרטי נכס"}
          </Badge>
          <Badge
            tone={
              kase.documents.length &&
              !kase.documents.some((d) => documentNeedsAttention(d))
                ? "teal"
                : "amber"
            }
          >
            {kase.documents.length
              ? `${kase.documents.filter((d) => documentNeedsAttention(d)).length} מסמכים לטיפול`
              : "טרם הוגדרה רשימת מסמכים"}
          </Badge>
          <Badge
            tone={kase.bankOffers.some((o) => o.selected) ? "teal" : "slate"}
          >
            {kase.bankOffers.some((o) => o.selected)
              ? "נבחרה הצעת בנק"
              : "טרם נבחרה הצעה"}
          </Badge>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          הפעולה הבאה: {kase.nextAction || "טרם הוגדרה"}
          {kase.followUpAt && ` · מעקב ב־${formatDate(kase.followUpAt)}`}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          שכר טרחה: {formatCurrency(kase.feeAgreed)} · שולם:{" "}
          {formatCurrency(kase.feePaid)} · יתרה:{" "}
          {formatCurrency(Math.max(0, kase.feeAgreed - kase.feePaid))}
        </p>
      </Panel>
      <section id="management" className="scroll-mt-28">
        <AddSection title="עריכת פרטי התיק, מעקב ושכר טרחה">
          <CaseWorkflowForm kase={kase} />
        </AddSection>
      </section>
      <section id="financials" className="scroll-mt-28">
        <CaseFinances
          caseId={kase.id}
          loanAmount={kase.amount}
          borrowers={kase.borrowers}
          property={kase.property}
        />
      </section>
      <section id="documents" className="scroll-mt-28">
        <DocumentsPanel caseId={kase.id} documents={kase.documents} />
      </section>
      <section id="banks" className="scroll-mt-28">
        <BankOffersPanel caseId={kase.id} offers={kase.bankOffers} />
      </section>

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
            {kase.scenarios.map((s) => {
              const savedInput = readSnapshot(s.snapshot);
              const assessment = savedInput
                ? simulate(savedInput).result.assessment
                : "legacy";
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {s.label ?? `תמהיל · ${formatCurrency(s.amount)}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {s.termMonths} חודשים · החזר{" "}
                      {formatCurrency(s.firstPayment)} · עלות{" "}
                      {formatCurrency(s.totalPaid)} · {formatDate(s.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      tone={
                        assessment === "fail"
                          ? "red"
                          : assessment === "pass"
                            ? "teal"
                            : "amber"
                      }
                    >
                      {assessment === "fail"
                        ? "חריגה בבדיקה"
                        : assessment === "pass"
                          ? "נבדק"
                          : assessment === "legacy"
                            ? "גרסה ישנה"
                            : "בדיקה חלקית"}
                    </Badge>
                    <Link
                      href={`/app/simulator?scenarioId=${s.id}`}
                      className="text-sm font-semibold text-teal-700"
                    >
                      פתיחה
                    </Link>
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
              );
            })}
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
