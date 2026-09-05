import type {
  ActivityChannel,
  CasePurpose,
  CaseStatus,
  ContactType,
  EmploymentType,
  LtvBasis,
  PropertyType,
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

export const employmentLabel: Record<EmploymentType, string> = {
  SALARIED: "שכיר/ה",
  SELF_EMPLOYED: "עצמאי/ת",
  BUSINESS_OWNER: "בעל/ת שליטה",
  PENSIONER: "פנסיונר/ית",
  OTHER: "אחר",
};

export const ltvBasisLabel: Record<LtvBasis, string> = {
  FIRST_HOME: "דירה ראשונה (עד 75%)",
  UPGRADER: "משפרי דיור (עד 70%)",
  INVESTMENT: "השקעה (עד 50%)",
  REFINANCE: "מיחזור (נדרשת בחינה פרטנית)",
  CONSOLIDATION: "לכל מטרה / איחוד הלוואות",
};

export const propertyTypeLabel: Record<PropertyType, string> = {
  APARTMENT: "דירה",
  HOUSE: "בית פרטי",
  PENTHOUSE: "פנטהאוז",
  LAND: "קרקע/בנייה",
  OTHER: "אחר",
};
