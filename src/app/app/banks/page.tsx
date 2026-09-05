import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { offerLabels, israelDate } from "@/lib/workspace";
import { formatCurrency, formatDate } from "@/lib/format";
import { PageHeading, Badge, Empty } from "@/components/workspace/ui";

export default async function BanksPage() {
  const { organizationId } = await requireUser();
  const offers = await prisma.bankOffer.findMany({
    where: { case: { organizationId, status: { notIn: ["CLOSED", "LOST"] } } },
    include: { case: { select: { contact: { select: { name: true } } } } },
    orderBy: { validUntil: { sort: "asc", nulls: "last" } },
  });
  return (
    <div className="workspace">
      <PageHeading
        title="בנקים ואישורים"
        description="מעקב אחר סבב הבנקים בתיקים הפעילים: בקשות שהוגשו, אישורים ותאריכי תוקף."
      />
      {!offers.length ? (
        <Empty
          title="אין הצעות בנק בתיקים פעילים"
          description="הוסיפו הצעה מתוך תיק הלקוח, תעדו את המסלולים ועקבו אחר האישור."
          href="/app/cases"
          label="פתיחת תיק לקוח"
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {offers.map((o) => (
            <article className="panel" key={o.id}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold">
                  {o.bank} · {o.case.contact.name}
                </h2>
                <Badge tone={o.status === "APPROVED" ? "teal" : "slate"}>
                  {offerLabels[o.status]}
                </Badge>
              </div>
              <p className="mt-4 text-xl font-bold">
                {formatCurrency(o.amount)}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                החזר ראשון: {formatCurrency(o.firstPayment)} · {o.termMonths}{" "}
                חודשים
              </p>
              <p
                className={`mt-3 text-sm ${o.validUntil && o.validUntil.toISOString().slice(0, 10) < israelDate() ? "font-semibold text-red-700" : "text-slate-500"}`}
              >
                {o.validUntil
                  ? `תוקף עד ${formatDate(o.validUntil)}`
                  : "תוקף לא הוזן"}
                {o.selected && " · נבחרה להמשך טיפול"}
              </p>
              {o.banker && (
                <p className="mt-3 text-xs text-slate-500">
                  איש קשר: {o.banker}
                  {o.phone && (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={`tel:${o.phone.replace(/[^+\d]/g, "")}`}
                        dir="ltr"
                        className="text-teal-700"
                      >
                        {o.phone}
                      </a>
                    </>
                  )}
                </p>
              )}
              <Link
                className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-teal-700"
                href={`/app/cases/${o.caseId}#banks`}
              >
                השוואה ועדכון בתיק ←
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
