"use client";

import { useTransition } from "react";
import type { CaseStatus } from "@prisma/client";
import { caseStatusLabel, caseStatusOrder } from "@/lib/labels";
import { updateCaseStatus } from "@/app/app/actions";

export function StatusSelect({
  caseId,
  status,
}: {
  caseId: string;
  status: CaseStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={status}
      disabled={pending}
      onChange={(e) => {
        const value = e.target.value;
        startTransition(() => updateCaseStatus(caseId, value));
      }}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium outline-none focus:border-indigo-500 disabled:opacity-50"
    >
      {caseStatusOrder.map((s) => (
        <option key={s} value={s}>
          {caseStatusLabel[s]}
        </option>
      ))}
    </select>
  );
}
