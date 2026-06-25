"use client";

import { useRef } from "react";
import { createTask } from "@/app/app/actions";

export function AddTaskForm({ caseId }: { caseId?: string }) {
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      action={async (fd) => {
        await createTask(fd);
        ref.current?.reset();
      }}
      className="flex flex-wrap items-end gap-2"
    >
      {caseId ? <input type="hidden" name="caseId" value={caseId} /> : null}
      <input
        name="title"
        required
        placeholder="משימה חדשה..."
        className="min-w-48 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
      />
      <input
        name="dueAt"
        type="date"
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
      />
      <button
        type="submit"
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        הוסף
      </button>
    </form>
  );
}
