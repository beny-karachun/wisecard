import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { documentLabels, documentNeedsAttention } from "@/lib/workspace";
import { formatDate } from "@/lib/format";
import { PageHeading, Badge, Empty } from "@/components/workspace/ui";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const { organizationId } = await requireUser();
  const { all } = await searchParams;
  const [documents, noChecklist] = await Promise.all([
    prisma.caseDocument.findMany({
      where: {
        case: {
          organizationId,
          ...(all === "1" ? {} : { status: { notIn: ["CLOSED", "LOST"] } }),
        },
      },
      include: {
        case: {
          select: {
            id: true,
            title: true,
            contact: { select: { name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.case.findMany({
      where: {
        organizationId,
        status: { notIn: ["CLOSED", "LOST"] },
        documents: { none: {} },
      },
      select: { id: true, contact: { select: { name: true } } },
    }),
  ]);
  const rows =
    all === "1"
      ? documents
      : documents.filter((d) => documentNeedsAttention(d));
  return (
    <div className="workspace">
      <PageHeading
        title="מרכז המסמכים"
        description="כל ההשלמות במקום אחד. רואים מה חסר, מה התקבל ומה ממתין לבדיקה בכל תיק."
        action={<Badge tone="amber">{rows.length} מסמכים בתצוגה</Badge>}
      />
      <div className="mb-6 flex gap-2">
        <Link
          href="/app/documents"
          className={all !== "1" ? "button-primary" : "button-secondary"}
        >
          לטיפול בתיקים פעילים
        </Link>
        <Link
          href="/app/documents?all=1"
          className={all === "1" ? "button-primary" : "button-secondary"}
        >
          כל המסמכים
        </Link>
      </div>
      {noChecklist.length > 0 && (
        <div className="panel mb-5">
          <h2 className="text-sm font-semibold">
            טרם הוגדרה רשימת מסמכים ב־{noChecklist.length} תיקים
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {noChecklist.map((c) => (
              <Link
                key={c.id}
                className="button-secondary"
                href={`/app/cases/${c.id}#documents`}
              >
                {c.contact.name}
              </Link>
            ))}
          </div>
        </div>
      )}
      {!rows.length ? (
        <Empty
          title="אין מסמכים בתצוגה"
          description="אפשר להוסיף רשימת מסמכים מתוך תיק הלקוח ולעדכן קישורים, תוקף וסטטוס בדיקה."
        />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[600px] text-right text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                {["מסמך", "לקוח / תיק", "מצב", "תוקף", ""].map((t, i) => (
                  <th key={i} className="px-3 py-3 font-medium">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-b border-slate-100">
                  <td className="px-3 py-4 font-semibold">{d.title}</td>
                  <td className="px-3 py-4">
                    {d.case.contact.name}
                    <p className="mt-1 text-xs text-slate-500">
                      {d.case.title}
                    </p>
                  </td>
                  <td className="px-3 py-4">
                    <Badge tone={documentNeedsAttention(d) ? "amber" : "teal"}>
                      {documentLabels[d.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-4">{formatDate(d.expiresAt)}</td>
                  <td className="px-3 py-4">
                    <Link
                      href={`/app/cases/${d.caseId}#documents`}
                      className="font-semibold text-teal-700"
                    >
                      טיפול בתיק ←
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
