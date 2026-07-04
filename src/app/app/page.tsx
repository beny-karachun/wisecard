import Link from "next/link";
import {
  FolderKanban,
  ListChecks,
  UserPlus,
  Users,
} from "lucide-react";
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
    { label: "אנשי קשר", value: contacts, href: "/app/contacts", icon: Users },
    { label: "לידים", value: leads, href: "/app/contacts", icon: UserPlus },
    {
      label: "תיקים פעילים",
      value: openCases,
      href: "/app/cases",
      icon: FolderKanban,
    },
    {
      label: "משימות פתוחות",
      value: openTasks,
      href: "/app/tasks",
      icon: ListChecks,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900">סקירה כללית</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-sm"
          >
            <div className="flex items-start justify-between">
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {s.value}
              </p>
              <s.icon className="h-5 w-5 text-slate-300" aria-hidden="true" />
            </div>
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
