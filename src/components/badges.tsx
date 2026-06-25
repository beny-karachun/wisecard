import type { CaseStatus, ContactType } from "@prisma/client";
import {
  caseStatusColor,
  caseStatusLabel,
  contactTypeLabel,
} from "@/lib/labels";

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${caseStatusColor[status]}`}
    >
      {caseStatusLabel[status]}
    </span>
  );
}

export function ContactTypeBadge({ type }: { type: ContactType }) {
  const cls =
    type === "CLIENT"
      ? "bg-indigo-100 text-indigo-700"
      : "bg-slate-100 text-slate-600";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      {contactTypeLabel[type]}
    </span>
  );
}
