import type {
  ActivityChannel,
  CasePurpose,
  CaseStatus,
  ContactType,
  Role,
} from "@prisma/client";

export const contactTypeLabel: Record<ContactType, string> = {
  LEAD: "ליד",
  CLIENT: "לקוח",
};

export const caseStatusLabel: Record<CaseStatus, string> = {
  NEW: "חדש",
  IN_PROGRESS: "בטיפול",
  SUBMITTED: "הוגש לבנק",
  APPROVED: "אושר",
  CLOSED: "נסגר",
  LOST: "אבוד",
};

// Display order for the pipeline columns.
export const caseStatusOrder: CaseStatus[] = [
  "NEW",
  "IN_PROGRESS",
  "SUBMITTED",
  "APPROVED",
  "CLOSED",
  "LOST",
];

export const caseStatusColor: Record<CaseStatus, string> = {
  NEW: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  SUBMITTED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  CLOSED: "bg-slate-200 text-slate-600",
  LOST: "bg-red-100 text-red-700",
};

export const casePurposeLabel: Record<CasePurpose, string> = {
  PURCHASE: "רכישה",
  REFINANCE: "מיחזור",
  EQUITY: "השלמת הון",
  OTHER: "אחר",
};

export const activityChannelLabel: Record<ActivityChannel, string> = {
  NOTE: "הערה",
  CALL: "שיחה",
  WHATSAPP: "וואטסאפ",
  EMAIL: "אימייל",
  MEETING: "פגישה",
};

export const roleLabel: Record<Role, string> = {
  PRINCIPAL: "מנהל",
  ADVISOR: "יועץ",
  ASSISTANT: "מזכירות",
};
