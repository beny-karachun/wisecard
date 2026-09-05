import Link from "next/link";
import { UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ContactTypeBadge } from "@/components/badges";
import { Field, SelectField } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { formatDate } from "@/lib/format";
import { createContact } from "@/app/app/actions";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; new?: string }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";
  const { organizationId } = await requireUser();
  const contacts = await prisma.contact.findMany({
    where: {
      organizationId,
      ...(q
        ? {
            OR: ["name", "phone", "email"].map((key) => ({
              [key]: { contains: q, mode: "insensitive" as const },
            })),
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { cases: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">לקוחות ולידים</h1>
        <span className="text-sm text-slate-500">{contacts.length} רשומות</span>
      </div>

      <details
        open={params.new === "1"}
        className="mt-6 rounded-xl border border-slate-200 bg-white p-4"
      >
        <summary className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-blue-600 transition hover:text-blue-700">
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          לקוח / ליד חדש
        </summary>
        <form
          action={createContact}
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <Field label="שם" name="name" required />
          <SelectField
            label="סוג"
            name="type"
            defaultValue="LEAD"
            options={[
              ["LEAD", "ליד"],
              ["CLIENT", "לקוח"],
            ]}
          />
          <Field
            label="טלפון"
            name="phone"
            dir="ltr"
            type="tel"
            inputMode="tel"
          />
          <Field
            label="אימייל"
            name="email"
            dir="ltr"
            type="email"
            inputMode="email"
          />
          <Field label="מקור" name="source" placeholder="פייסבוק, המלצה..." />
          <div className="sm:col-span-2">
            <SubmitButton>שמירה</SubmitButton>
          </div>
        </form>
      </details>

      <form className="mt-5 flex gap-2">
        <input
          aria-label="חיפוש לקוחות"
          name="q"
          defaultValue={q}
          placeholder="שם, טלפון או אימייל…"
          className="form-input"
        />
        <button className="button-primary">חיפוש</button>
        <Link href="/app/contacts" className="button-secondary">
          איפוס
        </Link>
      </form>
      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[600px] text-right text-sm">
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
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-slate-400"
                >
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
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <ContactTypeBadge type={c.type} />
                  </td>
                  <td
                    className="px-4 py-3 text-slate-600 tabular-nums"
                    dir="ltr"
                  >
                    {c.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 tabular-nums">
                    {c._count.cases}
                  </td>
                  <td className="px-4 py-3 text-slate-500 tabular-nums">
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
