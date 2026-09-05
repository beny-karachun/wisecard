import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  casePurposeLabel,
  caseStatusLabel,
  caseStatusOrder,
} from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/format";
import { israelDate, documentNeedsAttention } from "@/lib/workspace";
import {
  PageHeading,
  AddSection,
  Input,
  Select,
  Badge,
  Empty,
} from "@/components/workspace/ui";
import { createCase } from "@/app/app/actions";
import { SubmitButton } from "@/components/submit-button";

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    filter?: string;
    status?: string;
    new?: string;
  }>;
}) {
  const { organizationId } = await requireUser();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";
  const today = israelDate();
  const status = caseStatusOrder.find((s) => s === params.status);
  const where: Prisma.CaseWhereInput = {
    organizationId,
    status,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { contact: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(params.filter === "followup"
      ? {
          followUpAt: { lte: new Date(today) },
          status:
            status && status !== "CLOSED" && status !== "LOST"
              ? status
              : { in: ["NEW", "IN_PROGRESS", "SUBMITTED", "APPROVED"] },
        }
      : {}),
  };
  const [cases, contacts] = await Promise.all([
    prisma.case.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        contact: { select: { name: true } },
        documents: true,
        _count: { select: { bankOffers: true } },
      },
    }),
    prisma.contact.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <div className="workspace">
      <PageHeading
        title="תיקי משכנתא"
        description="כל תיק והשלב שלו: מאפיון הצרכים ועד לביצוע המשכנתא."
        action={<Badge tone="teal">{cases.length} תיקים בתצוגה</Badge>}
      />
      <AddSection title="פתיחת תיק משכנתא" open={params.new === "1"}>
        {contacts.length ? (
          <form action={createCase} className="grid gap-4 sm:grid-cols-2">
            <Select
              label="לקוח *"
              name="contactId"
              options={[
                ["", "בחירת לקוח"],
                ...contacts.map((c) => [c.id, c.name] as [string, string]),
              ]}
            />
            <Input
              label="כותרת התיק"
              name="title"
              placeholder="רכישת דירה ראשונה"
            />
            <Select
              label="מטרת ההלוואה"
              name="purpose"
              options={casePurposeLabel}
            />
            <Input label="סכום מבוקש (₪)" name="amount" type="number" min={1} />
            <div className="col-span-full">
              <SubmitButton>פתיחת תיק</SubmitButton>
            </div>
          </form>
        ) : (
          <Empty
            title="מתחילים בלקוח"
            description="הוסיפו לקוח או ליד כדי לפתוח עבורו תיק משכנתא."
            href="/app/contacts?new=1"
            label="הוספת לקוח"
          />
        )}
      </AddSection>
      <form className="panel mb-6 grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_auto]">
        <Input
          label="חיפוש תיק"
          name="q"
          defaultValue={q}
          placeholder="שם לקוח או תיק…"
        />
        <Select
          label="שלב"
          name="status"
          required={false}
          value={status ?? ""}
          options={[["", "כל השלבים"], ...Object.entries(caseStatusLabel)]}
        />
        <Select
          label="מעקב"
          name="filter"
          required={false}
          value={params.filter ?? ""}
          options={[
            ["", "כל התיקים"],
            ["followup", "מעקב להיום ובאיחור"],
          ]}
        />
        <div className="flex items-center gap-3">
          <button className="button-primary">סינון</button>
          <Link className="text-xs text-slate-500 underline" href="/app/cases">
            איפוס
          </Link>
        </div>
      </form>
      {!cases.length ? (
        <Empty
          title="אין תיקים להצגה"
          description="פתחו תיק חדש או שנו את תנאי החיפוש."
        />
      ) : (
        <div
          className="flex snap-x gap-4 overflow-x-auto pb-5"
          tabIndex={0}
          aria-label="לוח תיקי משכנתא"
        >
          {caseStatusOrder
            .filter((s) => !status || s === status)
            .map((s) => {
              const rows = cases.filter((c) => c.status === s);
              return (
                <section
                  key={s}
                  className="w-72 shrink-0 snap-start rounded-2xl bg-slate-100/80 p-3"
                >
                  <div className="mb-4 flex items-center justify-between px-1 pt-1">
                    <h2 className="text-sm font-bold">{caseStatusLabel[s]}</h2>
                    <Badge>{rows.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {rows.map((c) => (
                      <Link
                        key={c.id}
                        href={`/app/cases/${c.id}`}
                        className="block rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <p className="font-bold">{c.contact.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {c.title ?? casePurposeLabel[c.purpose]}
                        </p>
                        <p className="mt-4 text-lg font-bold">
                          {formatCurrency(c.amount)}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge
                            tone={
                              c.documents.some((d) => documentNeedsAttention(d))
                                ? "amber"
                                : "slate"
                            }
                          >
                            {c.documents.length
                              ? `${c.documents.filter((d) => documentNeedsAttention(d)).length} מסמכים לטיפול`
                              : "טרם הוגדרה רשימת מסמכים"}
                          </Badge>
                          <Badge>{c._count.bankOffers} הצעות</Badge>
                        </div>
                        <div className="mt-4 border-t border-slate-100 pt-3">
                          <p className="mb-2 text-xs leading-5 text-slate-600">
                            {c.nextAction || "טרם הוגדרה פעולה הבאה"}
                          </p>
                          {c.followUpAt && (
                            <Badge
                              tone={
                                c.followUpAt.toISOString().slice(0, 10) <
                                  today &&
                                c.status !== "CLOSED" &&
                                c.status !== "LOST"
                                  ? "red"
                                  : "slate"
                              }
                            >
                              {formatDate(c.followUpAt)}
                            </Badge>
                          )}
                        </div>
                      </Link>
                    ))}
                    {!rows.length && (
                      <p className="py-8 text-center text-xs text-slate-400">
                        אין תיקים בשלב זה
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
        </div>
      )}
    </div>
  );
}
