import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ContactTypeBadge } from "@/components/badges";
import { Field } from "@/components/field";
import { formatDate } from "@/lib/format";
import { createContact } from "@/app/app/actions";

export default async function ContactsPage() {
  const { organizationId } = await requireUser();
  const contacts = await prisma.contact.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { cases: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">לקוחות ולידים</h1>
        <span className="text-sm text-slate-500">{contacts.length} רשומות</span>
      </div>

      <details className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-indigo-600">
          + לקוח / ליד חדש
        </summary>
        <form
          action={createContact}
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <Field label="שם" name="name" required />
          <div>
            <label className="block text-sm font-medium text-slate-700">סוג</label>
            <select
              name="type"
              defaultValue="LEAD"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="LEAD">ליד</option>
              <option value="CLIENT">לקוח</option>
            </select>
          </div>
          <Field label="טלפון" name="phone" dir="ltr" />
          <Field label="אימייל" name="email" dir="ltr" />
          <Field label="מקור" name="source" placeholder="פייסבוק, המלצה..." />
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              שמירה
            </button>
          </div>
        </form>
      </details>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-right text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">שם</th>
              <th className="px-4 py-3 font-medium">סוג</th>
              <th className="px-4 py-3 font-medium">טלפון</th>
              <th className="px-4 py-3 font-medium">תיקים</th>
              <th className="px-4 py-3 font-medium">נוצר</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  אין רשומות עדיין. הוסף ליד או לקוח כדי להתחיל.
                </td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/app/contacts/${c.id}`}
                      className="font-medium text-indigo-600 hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <ContactTypeBadge type={c.type} />
                  </td>
                  <td className="px-4 py-3 text-slate-600" dir="ltr">
                    {c.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c._count.cases}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDate(c.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
