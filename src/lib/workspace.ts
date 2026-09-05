import { z } from "zod";
import type { CasePurpose } from "@prisma/client";

export const documentLabels = {
  MISSING: "חסר",
  RECEIVED: "התקבל",
  VERIFIED: "נבדק",
  NOT_REQUIRED: "לא נדרש",
};
export const offerLabels = {
  DRAFT: "טיוטה",
  SUBMITTED: "הוגש לבנק",
  APPROVED: "התקבל אישור",
  REJECTED: "נדחה",
};
export const appointmentLabels = {
  SCHEDULED: "מתוכננת",
  COMPLETED: "התקיימה",
  CANCELLED: "בוטלה",
};
export const trackLabels = {
  PRIME: "פריים",
  FIXED_UNLINKED: "קבועה לא צמודה",
  FIXED_LINKED: "קבועה צמודה",
  VARIABLE_UNLINKED: "משתנה לא צמודה",
  VARIABLE_LINKED: "משתנה צמודה",
  MAKAM: "מק״מ",
  ELIGIBILITY: "זכאות",
};
export type ActionState = { error?: string; success?: string };
const text = z.string().trim().max(5000).nullable();
const money = z.coerce.number().int().min(0).max(2_000_000_000);
const date = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.iso.date().nullable(),
);
const secureUrl = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z
    .url()
    .refine((v) => /^https:\/\//i.test(v))
    .nullable(),
);
export const caseWorkflowSchema = z
  .object({
    caseId: z.string().min(1),
    title: z.string().trim().min(1).max(200),
    purpose: z.enum(["PURCHASE", "REFINANCE", "EQUITY", "OTHER"]),
    amount: money.positive(),
    nextAction: text,
    followUpAt: date,
    expectedCompletion: date,
    feeAgreed: money,
    feePaid: money,
    notes: text,
  })
  .refine((v) => v.feePaid <= v.feeAgreed, {
    message: "הסכום ששולם לא יכול להיות גבוה משכר הטרחה שסוכם.",
  });
export const documentSchema = z.object({
  caseId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  status: z.enum(["MISSING", "RECEIVED", "VERIFIED", "NOT_REQUIRED"]),
  url: secureUrl,
  expiresAt: date,
  notes: text,
});
export const offerTrackSchema = z.object({
  type: z.enum([
    "PRIME",
    "FIXED_UNLINKED",
    "FIXED_LINKED",
    "VARIABLE_UNLINKED",
    "VARIABLE_LINKED",
    "MAKAM",
    "ELIGIBILITY",
  ]),
  amount: money.positive(),
  rate: z.coerce.number().min(0).max(30),
  termMonths: z.coerce.number().int().min(1).max(600),
});
export type OfferTrack = z.infer<typeof offerTrackSchema>;
export const offerSchema = z
  .object({
    caseId: z.string().min(1),
    bank: z.string().trim().min(1).max(100),
    banker: text,
    phone: text,
    status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]),
    amount: money.positive(),
    termMonths: z.coerce.number().int().min(1).max(600),
    firstPayment: money.positive(),
    totalPayment: z.preprocess(
      (v) => (v === "" || v == null ? null : v),
      money.positive().nullable(),
    ),
    validUntil: date,
    selected: z.boolean(),
    tracks: z.array(offerTrackSchema).max(10),
    url: secureUrl,
    notes: text,
  })
  .refine((v) => !v.selected || v.status === "APPROVED", {
    message: "ניתן לבחור רק הצעה שאושרה.",
  })
  .refine(
    (v) =>
      !v.tracks.length ||
      v.tracks.reduce((s, t) => s + t.amount, 0) === v.amount,
    { message: "סכום המסלולים חייב להיות שווה לסכום ההצעה." },
  )
  .refine(
    (v) =>
      !v.tracks.length ||
      Math.max(...v.tracks.map((t) => t.termMonths)) === v.termMonths,
    { message: "תקופת ההצעה חייבת להיות שווה לתקופת המסלול הארוך ביותר." },
  )
  .refine((v) => !v.selected || !v.validUntil || v.validUntil >= israelDate(), {
    message: "לא ניתן לבחור הצעה שפג תוקפה.",
  });
export const appointmentSchema = z.object({
  caseId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  startsAt: z.iso.datetime(),
  durationMinutes: z.coerce.number().int().min(15).max(240),
  location: text,
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]),
  notes: text,
});
export function israelDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function documentChecklist(purpose: CasePurpose) {
  const common = [
    "תעודות זהות וספחים",
    "אסמכתאות הכנסה",
    "תדפיסי חשבון בנק",
    "פירוט התחייבויות קיימות",
    "הסכם ייעוץ חתום",
  ];
  return [
    ...common,
    ...(purpose === "REFINANCE"
      ? ["דוח יתרות לסילוק", "פרטי המשכנתא הקיימת"]
      : purpose === "PURCHASE"
        ? ["חוזה רכישה", "אסמכתאות להון עצמי", "מסמכי זכויות בנכס"]
        : ["מסמכי הנכס ומטרת ההלוואה"]),
  ];
}
export function documentNeedsAttention(
  doc: { status: string; expiresAt: Date | null },
  today = israelDate(),
) {
  return (
    doc.status !== "NOT_REQUIRED" &&
    (doc.status !== "VERIFIED" ||
      Boolean(
        doc.expiresAt && doc.expiresAt.toISOString().slice(0, 10) < today,
      ))
  );
}
export function intervalsOverlap(
  start: Date,
  duration: number,
  otherStart: Date,
  otherDuration: number,
) {
  return (
    start.getTime() < otherStart.getTime() + otherDuration * 60000 &&
    otherStart.getTime() < start.getTime() + duration * 60000
  );
}
