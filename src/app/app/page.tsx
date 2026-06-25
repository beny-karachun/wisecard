import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ActivityTimeline } from "@/components/activity-timeline";

export default async function DashboardPage() {
  const { organizationId } = await requireUser();

  const [contacts, leads, openCases, openTasks, recent] = await Promise.all([
    prisma.contact.count({ where: { organizationId } }),
    prisma.contact.count({ where: { organizationId, type: "LEAD" } }),
    prisma.case.count({
      where: {
        organizationId,
        status: { in: ["NEW", "IN_PROGRESS", "SUBMITTED"] },
      },
    }),
    prisma.task.count({ where: { organizationId, done: false } }),
    prisma.activity.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { author: { select: { name: true, email: true } } },
    }),
  ]);

  const stats = [
    { label: "אנשי קשר", value: contacts, href: "/app/contacts" },
    { label: "לידים", value: leads, href: "/app/contacts" },
    { label: "תיקים פעילים", value: openCases, href: "/app/cases" },
    { label: "משימות פתוחות", value: openTasks, href: "/app/tasks" },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900">סקירה כללית</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-sm"
          >
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            <p className="mt-1 text-sm text-slate-500">{s.label}</p>
          </Link>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-semibold text-slate-900">
        פעילות אחרונה
      </h2>
      <div className="mt-3">
        <ActivityTimeline activities={recent} />
      </div>
    </div>
  );
}
