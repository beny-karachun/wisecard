import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FolderPlus, UserCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { CaseStatusBadge, ContactTypeBadge } from "@/components/badges";
import { Field, SelectField } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { ActivityTimeline } from "@/components/activity-timeline";
import { AddActivityForm } from "@/components/add-activity-form";
import { casePurposeLabel } from "@/lib/labels";
import { formatCurrency } from "@/lib/format";
import {
  convertContact,
  createCase,
  deleteContact,
  updateContact,
} from "@/app/app/actions";

export default async function ContactDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organizationId } = await requireUser();

  const contact = await prisma.contact.findFirst({
    where: { id, organizationId },
    include: {
      cases: { orderBy: { createdAt: "desc" } },
      activities: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true, email: true } } },
      },
    },
  });
  if (!contact) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/app/contacts"
            className="inline-flex items-center gap-1 text-sm text-slate-400 transition hover:text-slate-600"
          >
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            לקוחות ולידים
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{contact.name}</h1>
            <ContactTypeBadge type={contact.type} />
          </div>
          <p className="mt-1 text-sm text-slate-500" dir="ltr">
            {[contact.phone, contact.email].filter(Boolean).join(" · ")}
          </p>
        </div>
        {contact.type === "LEAD" && (
          <form action={convertContact.bind(null, contact.id)}>
            <SubmitButton variant="success">
              <UserCheck className="h-4 w-4" aria-hidden="true" />
              המר ללקוח
            </SubmitButton>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">תיקי משכנתא</h2>
          <div className="mt-3 space-y-2">
            {contact.cases.length === 0 ? (
              <p className="text-sm text-slate-400">אין תיקים.</p>
            ) : (
              contact.cases.map((k) => (
                <Link
                  key={k.id}
                  href={`/app/cases/${k.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 transition hover:bg-slate-50"
                >
                  <span className="text-sm font-medium text-slate-800">
                    {k.title ?? casePurposeLabel[k.purpose]}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    {formatCurrency(k.amount)}
                    <CaseStatusBadge status={k.status} />
                  </span>
                </Link>
              ))
            )}
          </div>

          <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <summary className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-blue-600 transition hover:text-blue-700">
              <FolderPlus className="h-4 w-4" aria-hidden="true" />
              תיק חדש
            </summary>
            <form action={createCase} className="mt-3 space-y-3">
              <input type="hidden" name="contactId" value={contact.id} />
              <Field label="כותרת (אופציונלי)" name="title" />
              <SelectField
                label="מטרה"
                name="purpose"
                defaultValue="PURCHASE"
                options={Object.entries(casePurposeLabel)}
              />
              <Field
                label="סכום מבוקש (₪)"
                name="amount"
                type="number"
                dir="ltr"
                inputMode="numeric"
              />
              <SubmitButton>צור תיק</SubmitButton>
            </form>
          </details>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">פעילות</h2>
          <div className="mt-3">
            <AddActivityForm contactId={contact.id} />
          </div>
          <div className="mt-4">
            <ActivityTimeline activities={contact.activities} />
          </div>
        </section>
      </div>

      <details className="rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-600">
          עריכת פרטים
        </summary>
        <form
          action={updateContact}
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="id" value={contact.id} />
          <Field label="שם" name="name" defaultValue={contact.name} required />
          <SelectField
            label="סוג"
            name="type"
            defaultValue={contact.type}
            options={[
              ["LEAD", "ליד"],
              ["CLIENT", "לקוח"],
            ]}
          />
          <Field
            label="טלפון"
            name="phone"
            defaultValue={contact.phone ?? ""}
            dir="ltr"
            type="tel"
            inputMode="tel"
          />
          <Field
            label="אימייל"
            name="email"
            defaultValue={contact.email ?? ""}
            dir="ltr"
            type="email"
            inputMode="email"
          />
          <Field
            label="מקור"
            name="source"
            defaultValue={contact.source ?? ""}
          />
          <div className="sm:col-span-2">
            <SubmitButton>שמירה</SubmitButton>
          </div>
        </form>
        <form
          action={deleteContact.bind(null, contact.id)}
          className="mt-4 border-t border-slate-100 pt-4"
        >
          <SubmitButton
            variant="danger"
            confirmMessage={`למחוק את ${contact.name} לצמיתות, כולל כל התיקים והפעילות?`}
          >
            מחק לקוח/ליד (כולל כל התיקים)
          </SubmitButton>
        </form>
      </details>
    </div>
  );
}
