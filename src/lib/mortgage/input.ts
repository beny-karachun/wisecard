import { z } from "zod";
import {
  MAX_PRINCIPAL,
  MAX_TERM_MONTHS,
  STRESS_MONTH,
  STRESS_CPI_BUMP,
  STRESS_RATE_BUMP,
} from "./tracks";
export const ENGINE_VERSION = 2;
export const trackTypeSchema = z.enum([
  "PRIME",
  "FIXED_UNLINKED",
  "FIXED_LINKED",
  "VARIABLE_UNLINKED",
  "VARIABLE_LINKED",
  "MAKAM",
  "ELIGIBILITY",
]);
const nonnegative = z.number().finite().min(0).max(MAX_PRINCIPAL);
export const storedLegSchema = z.object({
  type: trackTypeSchema,
  pct: z.number().finite().positive().max(100),
  rate: z.number().finite().min(0).max(30),
  termMonths: z.number().int().min(1).max(MAX_TERM_MONTHS).optional(),
});
export type StoredLeg = z.infer<typeof storedLegSchema>;
export const constraintsSchema = z.object({
  monthlyIncome: nonnegative.optional(),
  monthlyObligations: nonnegative.optional(),
  propertyValue: nonnegative.optional(),
  ltvBasis: z
    .enum([
      "FIRST_HOME",
      "UPGRADER",
      "INVESTMENT",
      "REFINANCE",
      "CONSOLIDATION",
    ])
    .optional(),
  existingHousingPayment: nonnegative.optional(),
  existingHousingBalance: nonnegative.optional(),
  sameBankBalance: nonnegative.optional(),
  sameBankVariableBalance: nonnegative.optional(),
  refinanceBalance: nonnegative.optional(),
  consolidationConcession: z.boolean().optional(),
  approvalDate: z.iso.date().optional(),
});
export const stressSchema = z.object({
  afterMonth: z
    .number()
    .int()
    .min(0)
    .max(MAX_TERM_MONTHS)
    .default(STRESS_MONTH),
  rateBump: z.number().finite().min(0).max(10).default(STRESS_RATE_BUMP),
  cpiBump: z.number().finite().min(0).max(10).default(STRESS_CPI_BUMP),
});
export type StressAssumptions = z.infer<typeof stressSchema>;
export const simulationSchema = z
  .object({
    amount: z.number().int().positive().max(MAX_PRINCIPAL),
    termMonths: z.number().int().min(1).max(MAX_TERM_MONTHS),
    cpi: z.number().finite().min(-5).max(15),
    legs: z.array(storedLegSchema).min(1).max(7),
    constraints: constraintsSchema.default({}),
    stress: stressSchema.default({
      afterMonth: STRESS_MONTH,
      rateBump: STRESS_RATE_BUMP,
      cpiBump: STRESS_CPI_BUMP,
    }),
    monthlyInsurance: nonnegative.default(0),
    upfrontCosts: nonnegative.default(0),
  })
  .superRefine((value, ctx) => {
    const c = value.constraints;
    if (
      c.sameBankBalance != null &&
      c.existingHousingBalance != null &&
      c.sameBankBalance > c.existingHousingBalance
    )
      ctx.addIssue({
        code: "custom",
        message: "האשראי באותו בנק לא יכול לעלות על כלל האשראי הנותר בנכס",
        path: ["constraints"],
      });
    if (
      c.sameBankVariableBalance != null &&
      c.sameBankBalance != null &&
      c.sameBankVariableBalance > c.sameBankBalance
    )
      ctx.addIssue({
        code: "custom",
        message: "יתרת הריבית המשתנה לא יכולה לעלות על האשראי הנותר באותו בנק",
        path: ["constraints"],
      });
    if (new Set(value.legs.map((l) => l.type)).size !== value.legs.length)
      ctx.addIssue({
        code: "custom",
        message: "כל סוג מסלול יכול להופיע פעם אחת בתמהיל",
        path: ["legs"],
      });
    if (Math.abs(value.legs.reduce((sum, l) => sum + l.pct, 0) - 100) > 1e-7)
      ctx.addIssue({
        code: "custom",
        message: "סך ההקצאה חייב להיות בדיוק 100%",
        path: ["legs"],
      });
  });
export type SimulationInput = z.infer<typeof simulationSchema>;
export const scenarioInputSchema = z.object({
  caseId: z.string().min(1),
  label: z.string().trim().min(1).max(120),
  simulation: simulationSchema,
});
export function inputError(error: z.ZodError) {
  const issue = error.issues[0];
  if (issue.code === "custom") return issue.message;
  const names: Record<string, string> = {
    amount: "סכום ההלוואה",
    termMonths: "תקופה בחודשים (1–360)",
    cpi: "הנחת המדד (‎-5% עד 15%)",
    legs: "המסלולים: חלק, ריבית או תקופה",
    constraints: "נתוני משק הבית והנכס",
    stress: "הנחות תרחיש הלחץ",
    monthlyInsurance: "ביטוח חודשי",
    upfrontCosts: "עלויות חד־פעמיות",
  };
  return `יש לבדוק את ${names[String(issue.path[0] === "simulation" ? issue.path[1] : issue.path[0])] ?? "השדות"}. נדרשים ערכים מספריים תקינים בטווח המותר.`;
}
