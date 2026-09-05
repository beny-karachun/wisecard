import Link from "next/link";
import {
  FolderKanban,
  Users,
  FileCheck2,
  CalendarDays,
  ArrowUpLeft,
  Plus,
  Calculator,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ActivityTimeline } from "@/components/activity-timeline";
import { TaskToggle } from "@/components/task-toggle";
import { PageHeading, Panel, Empty, Badge } from "@/components/workspace/ui";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { israelDate, documentNeedsAttention } from "@/lib/workspace";
import { caseStatusLabel, caseStatusOrder } from "@/lib/labels";

export default async function DashboardPage() {
  const user = await requireUser();
  const { organizationId } = user;
  const now = new Date();
  const today = israelDate(now);
  const [contacts, cases, tasks, appointments, recent] = await Promise.all([
    prisma.contact.count({ where: { organizationId } }),
    prisma.case.findMany({
      where: { organizationId },
      include: {
        contact: { select: { name: true } },
        documents: true,
        bankOffers: true,
      },
      orderBy: { followUpAt: { sort: "asc", nulls: "last" } },
    }),
    prisma.task.findMany({
      where: { organizationId, done: false },
      orderBy: { dueAt: { sort: "asc", nulls: "last" } },
      take: 6,
    }),
    prisma.appointment.findMany({
      where: {
        case: { organizationId },
        status: "SCHEDULED",
        startsAt: { gte: now },
      },
      include: { case: { select: { contact: { select: { name: true } } } } },
      orderBy: { startsAt: "asc" },
      take: 4,
    }),
    prisma.activity.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { author: { select: { name: true, email: true } } },
    }),
  ]);
  const active = cases.filter(
    (c) => c.status !== "CLOSED" && c.status !== "LOST",
  );
  const followUps = active.filter(
    (c) => c.followUpAt && c.followUpAt.toISOString().slice(0, 10) <= today,
  );
  const docs = active.reduce(
    (sum, c) =>
      sum + c.documents.filter((d) => documentNeedsAttention(d)).length,
    0,
  );
  const outstanding = cases
    .filter((c) => c.status !== "LOST")
    .reduce((sum, c) => sum + Math.max(0, c.feeAgreed - c.feePaid), 0);
  const expiring = active.flatMap((c) =>
    c.bankOffers
      .filter(
        (o) =>
          o.status === "APPROVED" &&
          o.validUntil &&
          o.validUntil.getTime() <= new Date(today).getTime() + 7 * 86400000,
      )
      .map((o) => ({ ...o, clientName: c.contact.name })),
  );
  const date = new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  const stats = [
    {
      label: "תיקי משכנתא פעילים",
      value: active.length,
      hint: `${followUps.length} ממתינים למעקב`,
      href: "/app/cases",
      icon: FolderKanban,
    },
    {
      label: "לקוחות ולידים",
      value: contacts,
      hint: "כל מערכות היחסים במקום אחד",
      href: "/app/contacts",
      icon: Users,
    },
    {
      label: "מסמכים לטיפול",
      value: docs,
      hint: "חסרים, לבדיקה או שפג תוקפם",
      href: "/app/documents",
      icon: FileCheck2,
    },
    {
      label: "יתרת שכר טרחה",
      value: formatCurrency(outstanding),
      hint: "לפי הסכומים שסוכמו בתיקים",
      href: "/app/fees",
      icon: ArrowUpLeft,
    },
  ];
  return (
    <div className="workspace">
      <PageHeading
        eyebrow={date}
        title={`שלום, ${user.name?.split(" ")[0] || "נעים לראות אותך"}`}
        description="תמונת המצב של המשרד: התיקים, האישורים והצעדים הבאים שלך."
        action={
          <Link href="/app/cases?new=1" className="button-primary">
            <Plus size={17} aria-hidden />
            תיק משכנתא חדש
          </Link>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="panel group transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">
                {s.label}
              </span>
              <s.icon
                size={19}
                className="shrink-0 text-teal-600"
                aria-hidden
              />
            </div>
            <p className="mt-5 break-words text-2xl font-bold tracking-tight sm:text-3xl">
              {s.value}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-400">{s.hint}</p>
          </Link>
        ))}
      </div>
      <div className="mb-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="מה דורש תשומת לב" href="/app/cases?filter=followup">
          {followUps.length ? (
            <ul className="divide-y divide-slate-100">
              {followUps.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/app/cases/${c.id}`}
                    className="flex items-center justify-between gap-3 py-4"
                  >
                    <div>
                      <p className="text-sm font-semibold">{c.contact.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {c.nextAction || "עדכון ההתקדמות בתיק"}
                      </p>
                    </div>
                    <Badge
                      tone={
                        c.followUpAt!.toISOString().slice(0, 10) < today
                          ? "red"
                          : "amber"
                      }
                    >
                      {formatDate(c.followUpAt)}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              title="אין מעקבים שממתינים להיום"
              description="הגדירו פעולה הבאה ותאריך מעקב בכל תיק כדי לשמור על רצף הטיפול."
              href="/app/cases"
              label="ללוח התיקים"
            />
          )}
          {expiring.slice(0, 4).map((o) => (
            <Link
              key={o.id}
              href={`/app/cases/${o.caseId}#banks`}
              className="mt-3 block rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900"
            >
              {o.validUntil!.toISOString().slice(0, 10) < today
                ? "פג תוקף האישור"
                : "תוקף האישור מסתיים בקרוב"}{" "}
              · {o.bank} · {o.clientName} · {formatDate(o.validUntil)}
            </Link>
          ))}
        </Panel>
        <Panel title="הפגישות הקרובות" href="/app/calendar">
          {appointments.length ? (
            <ul className="divide-y divide-slate-100">
              {appointments.map((a) => (
                <li key={a.id}>
                  <Link href="/app/calendar" className="flex gap-3 py-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                      <CalendarDays size={18} aria-hidden />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{a.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {a.case.contact.name}
                      </p>
                      <p className="mt-2 text-xs font-medium text-teal-700">
                        {formatDateTime(a.startsAt)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              title="מקום לפגישה הבאה"
              description="פגישת אפיון, הצגת תמהיל או חתימות בבנק — קובעים מתוך תיק הלקוח."
              href="/app/calendar?new=1"
              label="תיאום פגישה"
            />
          )}
        </Panel>
      </div>
      <Panel title="תמונת תיקי המשכנתא" href="/app/cases" className="mb-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {caseStatusOrder.map((status) => (
            <Link
              href={`/app/cases?status=${status}`}
              key={status}
              className="rounded-xl bg-slate-50 p-4"
            >
              <div
                className={`mb-3 h-1 rounded-full ${status === "APPROVED" ? "bg-teal-500" : "bg-teal-200"}`}
              />
              <p className="text-xs text-slate-500">
                {caseStatusLabel[status]}
              </p>
              <p className="mt-2 text-2xl font-bold">
                {cases.filter((c) => c.status === status).length}
              </p>
            </Link>
          ))}
        </div>
      </Panel>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="משימות פתוחות" href="/app/tasks">
          {tasks.length ? (
            <ul className="divide-y divide-slate-100">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <TaskToggle id={t.id} done={t.done} />
                  <span className="flex-1 text-sm">{t.title}</span>
                  {t.dueAt && (
                    <Badge
                      tone={
                        t.dueAt.toISOString().slice(0, 10) < today
                          ? "red"
                          : "slate"
                      }
                    >
                      {formatDate(t.dueAt)}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              title="אין משימות פתוחות"
              description="רכזו כאן שיחות, מסמכים וכל דבר שצריך לסגור."
              href="/app/tasks"
              label="הוספת משימה"
            />
          )}
        </Panel>
        <Panel title="פעילות אחרונה">
          <ActivityTimeline activities={recent} />
        </Panel>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-teal-950 px-6 py-5 text-white">
        <div className="flex items-center gap-3">
          <Calculator size={22} className="text-teal-300" aria-hidden />
          <div>
            <p className="text-sm font-semibold">
              מהנתונים לתמהיל שמתאים ללקוח
            </p>
            <p className="mt-1 text-xs text-teal-200">
              מסלולים, תרחישים, השוואות ודוחות מתוך תיק המשכנתא
            </p>
          </div>
        </div>
        <Link
          href="/app/simulator"
          className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-teal-100"
        >
          לסימולטור המשכנתא <ArrowUpLeft size={16} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
