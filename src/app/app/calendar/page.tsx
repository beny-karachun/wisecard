import Link from "next/link";
import { CalendarDays, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import { appointmentLabels, israelDate } from "@/lib/workspace";
import { AppointmentForm } from "@/components/workspace/forms";
import {
  PageHeading,
  AddSection,
  Badge,
  Empty,
} from "@/components/workspace/ui";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ caseId?: string; new?: string; history?: string }>;
}) {
  const { organizationId } = await requireUser();
  const params = await searchParams;
  const now = new Date();
  const [appointments, cases] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        case: { organizationId },
        ...(params.history === "1" ? {} : { status: "SCHEDULED" as const }),
      },
      include: {
        case: { include: { contact: true } },
        advisor: { select: { name: true } },
      },
      orderBy: { startsAt: params.history === "1" ? "desc" : "asc" },
    }),
    prisma.case.findMany({
      where: { organizationId },
      select: { id: true, title: true, contact: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const groups = new Map<string, typeof appointments>();
  for (const appointment of appointments) {
    const day = israelDate(appointment.startsAt);
    groups.set(day, [...(groups.get(day) ?? []), appointment]);
  }
  return (
    <div className="workspace">
      <PageHeading
        title="יומן פגישות"
        description="פגישות אפיון, הצגת תמהילים וחתימות בבנק. יומן המשרד מוצג לפי שעון ישראל."
        action={
          <a href="/app/calendar/export" className="button-secondary">
            <Download size={16} aria-hidden />
            ייצוא ליומן
          </a>
        }
      />
      <AddSection title="תיאום פגישה חדשה" open={params.new === "1"}>
        {cases.length ? (
          <AppointmentForm cases={cases} caseId={params.caseId} />
        ) : (
          <Empty
            title="מתחילים בתיק לקוח"
            description="פתחו תיק משכנתא כדי לקבוע את הפגישה הראשונה."
            href="/app/cases?new=1"
            label="פתיחת תיק"
          />
        )}
      </AddSection>
      <div className="mb-6 flex gap-2">
        <Link
          className={
            params.history !== "1" ? "button-primary" : "button-secondary"
          }
          href="/app/calendar"
        >
          פגישות לטיפול
        </Link>
        <Link
          className={
            params.history === "1" ? "button-primary" : "button-secondary"
          }
          href="/app/calendar?history=1"
        >
          כל הפגישות
        </Link>
      </div>
      {!appointments.length ? (
        <Empty
          title="היומן פנוי"
          description="קבעו פגישה מתוך תיק הלקוח או ישירות מכאן."
        />
      ) : (
        <div className="space-y-7">
          {Array.from(groups.entries()).map(([day, rows]) => (
            <section key={day}>
              <h2 className="mb-3 text-sm font-semibold text-slate-600">
                {new Intl.DateTimeFormat("he-IL", {
                  timeZone: "UTC",
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(new Date(day))}
                {day === israelDate(now) && " · היום"}
              </h2>
              <div className="space-y-3">
                {rows.map((a) => (
                  <article className="panel" key={a.id}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                          <CalendarDays size={21} aria-hidden />
                        </div>
                        <div>
                          <h3 className="font-bold">{a.title}</h3>
                          <Link
                            href={`/app/cases/${a.caseId}`}
                            className="mt-1 inline-block text-sm text-teal-700"
                          >
                            {a.case.contact.name} ·{" "}
                            {a.case.title || "תיק משכנתא"}
                          </Link>
                          <p className="mt-2 text-xs text-slate-500">
                            יועץ: {a.advisor.name || "ללא שם"}
                            {a.location && ` · ${a.location}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-sm">
                        <p className="mb-2 font-semibold">
                          {formatDateTime(a.startsAt)} · {a.durationMinutes}{" "}
                          דקות
                        </p>
                        <Badge
                          tone={
                            a.status === "SCHEDULED" && a.startsAt < now
                              ? "amber"
                              : "teal"
                          }
                        >
                          {a.status === "SCHEDULED" && a.startsAt < now
                            ? "ממתינה לעדכון תוצאה"
                            : appointmentLabels[a.status]}
                        </Badge>
                      </div>
                    </div>
                    {a.notes && (
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-500">
                        {a.notes}
                      </p>
                    )}
                    <details className="mt-4 border-t border-slate-100 pt-2">
                      <summary className="min-h-10 py-2 text-sm font-semibold text-teal-700">
                        עריכה, שינוי מועד או סיכום פגישה
                      </summary>
                      <div className="mt-4">
                        <AppointmentForm cases={cases} appointment={a} />
                      </div>
                    </details>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
