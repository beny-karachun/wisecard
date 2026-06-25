import Link from "next/link";
import type { CasePurpose } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { AddTaskForm } from "@/components/add-task-form";
import { casePurposeLabel } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { toggleTask } from "@/app/app/actions";

type TaskRow = {
  id: string;
  title: string;
  done: boolean;
  dueAt: Date | null;
  case: {
    id: string;
    title: string | null;
    purpose: CasePurpose;
    contact: { name: string };
  } | null;
};

function TaskList({ tasks }: { tasks: TaskRow[] }) {
  if (tasks.length === 0) {
    return <p className="mt-3 text-sm text-slate-400">אין משימות.</p>;
  }
  return (
    <ul className="mt-3 space-y-2">
      {tasks.map((t) => (
        <li
          key={t.id}
          className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
        >
          <form action={toggleTask.bind(null, t.id)}>
            <button
              type="submit"
              aria-label="סמן כבוצע"
              className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
                t.done
                  ? "border-green-600 bg-green-600 text-white"
                  : "border-slate-300 bg-white"
              }`}
            >
              {t.done ? "✓" : ""}
            </button>
          </form>
          <div className="flex-1">
            <span
              className={`text-sm ${
                t.done ? "text-slate-400 line-through" : "text-slate-800"
              }`}
            >
              {t.title}
            </span>
            {t.case && (
              <Link
                href={`/app/cases/${t.case.id}`}
                className="mt-0.5 block text-xs text-slate-400 hover:text-indigo-600 hover:underline"
              >
                {t.case.contact.name} · {t.case.title ?? casePurposeLabel[t.case.purpose]}
              </Link>
            )}
          </div>
          {t.dueAt && (
            <span className="text-xs text-slate-400">{formatDate(t.dueAt)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function TasksPage() {
  const { organizationId } = await requireUser();
  const tasks = await prisma.task.findMany({
    where: { organizationId },
    orderBy: [{ done: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    include: {
      case: {
        select: {
          id: true,
          title: true,
          purpose: true,
          contact: { select: { name: true } },
        },
      },
    },
  });

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">משימות</h1>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
        <AddTaskForm />
      </div>

      <h2 className="mt-8 text-sm font-semibold text-slate-500">
        פתוחות ({open.length})
      </h2>
      <TaskList tasks={open} />

      {done.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold text-slate-500">
            הושלמו ({done.length})
          </h2>
          <TaskList tasks={done} />
        </>
      )}
    </div>
  );
}
