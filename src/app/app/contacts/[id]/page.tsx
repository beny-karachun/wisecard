import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { CaseStatusBadge, ContactTypeBadge } from "@/components/badges";
import { Field } from "@/components/field";
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
            className="text-sm text-slate-400 hover:underline"
          >
            ← לקוחות ולידים
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
            <button
              type="submit"
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              המר ללקוח
            </button>
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
            <summary className="cursor-pointer text-sm font-semibold text-indigo-600">
              + תיק חדש
            </summary>
            <form action={createCase} className="mt-3 space-y-3">
              <input type="hidden" name="contactId" value={contact.id} />
              <Field label="כותרת (אופציונלי)" name="title" />
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  מטרה
                </label>
                <select
                  name="purpose"
                  defaultValue="PURCHASE"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {Object.entries(casePurposeLabel).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <Field label="סכום מבוקש (₪)" name="amount" type="number" dir="ltr" />
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                צור תיק
              </button>
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
          <div>
            <label className="block text-sm font-medium text-slate-700">סוג</label>
            <select
              name="type"
              defaultValue={contact.type}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="LEAD">ליד</option>
              <option value="CLIENT">לקוח</option>
            </select>
          </div>
          <Field
            label="טלפון"
            name="phone"
            defaultValue={contact.phone ?? ""}
            dir="ltr"
          />
          <Field
            label="אימייל"
            name="email"
            defaultValue={contact.email ?? ""}
            dir="ltr"
          />
          <Field
            label="מקור"
            name="source"
            defaultValue={contact.source ?? ""}
          />
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              שמירה
            </button>
          </div>
        </form>
        <form
          action={deleteContact.bind(null, contact.id)}
          className="mt-4 border-t border-slate-100 pt-4"
        >
          <button
            type="submit"
            className="text-sm font-medium text-red-600 hover:underline"
          >
            מחק לקוח/ליד (כולל כל התיקים)
          </button>
        </form>
      </details>
    </div>
  );
}
