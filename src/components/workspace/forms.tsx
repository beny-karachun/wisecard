import type { Case, CaseDocument, Appointment } from "@prisma/client";
import {
  saveCaseWorkflow,
  saveDocument,
  saveAppointment,
} from "@/app/app/workspace-actions";
import { ActionForm, LocalDateTime } from "./action-form";
import { Input, Select, Notes } from "./ui";
import { documentLabels, appointmentLabels } from "@/lib/workspace";
import { casePurposeLabel } from "@/lib/labels";

export type CaseOption = {
  id: string;
  title: string | null;
  contact: { name: string };
};
export const caseOptions = (cases: CaseOption[]): [string, string][] => [
  ["", "בחירת תיק"],
  ...cases.map(
    (c) =>
      [c.id, `${c.contact.name}${c.title ? ` · ${c.title}` : ""}`] as [
        string,
        string,
      ],
  ),
];
export function CaseWorkflowForm({ kase }: { kase: Case }) {
  return (
    <ActionForm action={saveCaseWorkflow}>
      <input type="hidden" name="caseId" value={kase.id} />
      <Input
        label="שם התיק *"
        name="title"
        required
        maxLength={200}
        defaultValue={kase.title ?? casePurposeLabel[kase.purpose]}
      />
      <Select
        label="מטרת ההלוואה"
        name="purpose"
        options={casePurposeLabel}
        value={kase.purpose}
      />
      <Input
        label="סכום משכנתא מבוקש (₪) *"
        name="amount"
        type="number"
        min={1}
        required
        defaultValue={kase.amount ?? ""}
      />
      <Input
        label="תאריך ביצוע מתוכנן"
        name="expectedCompletion"
        type="date"
        defaultValue={kase.expectedCompletion?.toISOString().slice(0, 10) ?? ""}
      />
      <Input
        label="הפעולה הבאה"
        name="nextAction"
        defaultValue={kase.nextAction ?? ""}
        placeholder="למשל: לקבל אישור עקרוני מהבנק"
      />
      <Input
        label="תאריך מעקב"
        name="followUpAt"
        type="date"
        defaultValue={kase.followUpAt?.toISOString().slice(0, 10) ?? ""}
      />
      <Input
        label="שכר טרחה מוסכם (₪)"
        name="feeAgreed"
        type="number"
        min={0}
        required
        defaultValue={kase.feeAgreed}
      />
      <Input
        label="שכר טרחה ששולם (₪)"
        name="feePaid"
        type="number"
        min={0}
        required
        defaultValue={kase.feePaid}
      />
      <p className="col-span-full text-xs text-slate-500">
        יש להזין סכומים באותו בסיס מס. זהו מעקב גבייה פנימי; אין הפקת חשבוניות
        או חישוב מע״מ.
      </p>
      <Notes value={kase.notes} />
    </ActionForm>
  );
}
export function DocumentForm({
  caseId,
  document,
}: {
  caseId: string;
  document?: CaseDocument;
}) {
  return (
    <ActionForm
      action={saveDocument}
      label={document ? "עדכון מסמך" : "הוספת מסמך"}
    >
      <input type="hidden" name="id" value={document?.id ?? ""} />
      <input type="hidden" name="caseId" value={caseId} />
      <Input
        label="שם המסמך *"
        name="title"
        required
        maxLength={200}
        defaultValue={document?.title}
      />
      <Select
        label="מצב המסמך"
        name="status"
        options={documentLabels}
        value={document?.status}
      />
      <Input
        label="קישור למסמך (https)"
        name="url"
        type="url"
        dir="ltr"
        defaultValue={document?.url ?? ""}
      />
      <Input
        label="תוקף עד (אם רלוונטי)"
        name="expiresAt"
        type="date"
        defaultValue={document?.expiresAt?.toISOString().slice(0, 10) ?? ""}
      />
      <Notes label="הערות לבדיקה / השלמה" value={document?.notes} />
    </ActionForm>
  );
}
export function AppointmentForm({
  cases,
  appointment,
  caseId,
}: {
  cases: CaseOption[];
  appointment?: Appointment;
  caseId?: string;
}) {
  return (
    <ActionForm
      action={saveAppointment}
      label={appointment ? "עדכון פגישה" : "קביעת פגישה"}
    >
      <input type="hidden" name="id" value={appointment?.id ?? ""} />
      <Select
        label="תיק לקוח *"
        name="caseId"
        options={caseOptions(cases)}
        value={appointment?.caseId ?? caseId}
      />
      <Input
        label="נושא הפגישה *"
        name="title"
        required
        defaultValue={appointment?.title}
        placeholder="אפיון צרכים, הצגת תמהיל, חתימות בבנק…"
      />
      <LocalDateTime value={appointment?.startsAt.toISOString()} />
      <Input
        label="משך (דקות)"
        name="durationMinutes"
        type="number"
        min={15}
        max={240}
        required
        defaultValue={appointment?.durationMinutes ?? 60}
      />
      <Input
        label="מיקום / פרטי שיחה"
        name="location"
        defaultValue={appointment?.location ?? ""}
      />
      <Select
        label="סטטוס"
        name="status"
        options={appointmentLabels}
        value={appointment?.status}
      />
      <Notes label="הערות / סיכום פגישה" value={appointment?.notes} />
    </ActionForm>
  );
}
