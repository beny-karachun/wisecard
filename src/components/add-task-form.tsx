"use client";

import { useRef } from "react";
import { createTask } from "@/app/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { inputClass } from "@/components/field";

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
      <label className="min-w-48 flex-1">
        <span className="sr-only">כותרת המשימה</span>
        <input
          name="title"
          required
          placeholder="משימה חדשה..."
          className={inputClass}
        />
      </label>
      <label>
        <span className="sr-only">תאריך יעד</span>
        <input name="dueAt" type="date" className={`${inputClass} w-auto`} />
      </label>
      <SubmitButton>הוסף</SubmitButton>
    </form>
  );
}
