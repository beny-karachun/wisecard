"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  caseWorkflowSchema,
  documentSchema,
  offerSchema,
  appointmentSchema,
  documentChecklist,
  intervalsOverlap,
  type ActionState,
} from "@/lib/workspace";

function read(form: FormData) {
  const data: Record<string, unknown> = Object.fromEntries(form);
  for (const key of [
    "notes",
    "nextAction",
    "url",
    "banker",
    "phone",
    "location",
  ])
    data[key] = form.get(key) || null;
  data.selected = form.get("selected") === "on";
  return data;
}
const invalid = {
  error: "יש לבדוק את השדות: פרטים נדרשים, סכומים חיוביים ותאריכים תקינים.",
};
const missing = {
  error: "הרשומה לא נמצאה במשרד שלך. יש לרענן את העמוד ולנסות שוב.",
};
const failed = { error: "השמירה לא הושלמה. יש לנסות שוב." };
function refresh() {
  revalidatePath("/app", "layout");
}
async function ownedCase(caseId: string, organizationId: string) {
  return prisma.case.findFirst({
    where: { id: caseId, organizationId },
    select: { id: true, purpose: true },
  });
}

export async function saveCaseWorkflow(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { organizationId } = await requireUser();
  const parsed = caseWorkflowSchema.safeParse(read(form));
  if (!parsed.success)
    return {
      error:
        parsed.error.issues.find((i) => !i.path.length)?.message ??
        invalid.error,
    };
  const { caseId, followUpAt, expectedCompletion, ...data } = parsed.data;
  try {
    const result = await prisma.case.updateMany({
      where: { id: caseId, organizationId },
      data: {
        ...data,
        followUpAt: followUpAt ? new Date(followUpAt) : null,
        expectedCompletion: expectedCompletion
          ? new Date(expectedCompletion)
          : null,
      },
    });
    if (!result.count) return missing;
  } catch {
    return failed;
  }
  refresh();
  return { success: "פרטי התיק ושכר הטרחה נשמרו." };
}

export async function initializeDocuments(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { organizationId } = await requireUser();
  const kase = await ownedCase(
    String(form.get("caseId") || ""),
    organizationId,
  );
  if (!kase) return missing;
  try {
    await prisma.caseDocument.createMany({
      data: documentChecklist(kase.purpose).map((title) => ({
        caseId: kase.id,
        title,
      })),
      skipDuplicates: true,
    });
  } catch {
    return failed;
  }
  refresh();
  return { success: "רשימת המסמכים נוספה. ניתן להתאים אותה לצורכי התיק." };
}

export async function saveDocument(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { organizationId } = await requireUser();
  const parsed = documentSchema.safeParse(read(form));
  if (!parsed.success)
    return { error: "יש להזין שם מסמך, תאריך תקין וקישור https תקין אם קיים." };
  if (!(await ownedCase(parsed.data.caseId, organizationId))) return missing;
  const id = String(form.get("id") || "");
  const { expiresAt, ...fields } = parsed.data;
  const data = { ...fields, expiresAt: expiresAt ? new Date(expiresAt) : null };
  try {
    if (id) {
      const result = await prisma.caseDocument.updateMany({
        where: { id, caseId: data.caseId, case: { organizationId } },
        data,
      });
      if (!result.count) return missing;
    } else await prisma.caseDocument.create({ data });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return { error: "מסמך בשם זה כבר קיים בתיק. אפשר לעדכן אותו ברשימה." };
    return failed;
  }
  refresh();
  return { success: "פרטי המסמך נשמרו." };
}

export async function saveBankOffer(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { organizationId, id: authorId } = await requireUser();
  let tracks: unknown;
  try {
    tracks = JSON.parse(String(form.get("tracks") || "[]"));
  } catch {
    return invalid;
  }
  const parsed = offerSchema.safeParse({ ...read(form), tracks });
  if (!parsed.success)
    return {
      error:
        parsed.error.issues.find((i) => !i.path.length)?.message ??
        invalid.error,
    };
  if (!(await ownedCase(parsed.data.caseId, organizationId))) return missing;
  const id = String(form.get("id") || "");
  const { validUntil, ...fields } = parsed.data;
  const data = {
    ...fields,
    validUntil: validUntil ? new Date(validUntil) : null,
  };
  try {
    const saved = await prisma.$transaction(
      async (tx) => {
        if (
          id &&
          !(await tx.bankOffer.findFirst({
            where: { id, caseId: data.caseId, case: { organizationId } },
          }))
        )
          return false;
        if (data.selected)
          await tx.bankOffer.updateMany({
            where: { caseId: data.caseId, case: { organizationId } },
            data: { selected: false },
          });
        if (id) await tx.bankOffer.update({ where: { id }, data });
        else await tx.bankOffer.create({ data });
        await tx.activity.create({
          data: {
            organizationId,
            caseId: data.caseId,
            authorId,
            channel: "NOTE",
            body: `הצעת בנק ${data.bank} ${id ? "עודכנה" : "נוספה"}${data.selected ? " ונבחרה להמשך טיפול" : ""}.`,
          },
        });
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (!saved) return missing;
  } catch {
    return failed;
  }
  refresh();
  return { success: "הצעת הבנק נשמרה." };
}

export async function saveAppointment(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { organizationId, id: advisorId } = await requireUser();
  const parsed = appointmentSchema.safeParse(read(form));
  if (!parsed.success) return invalid;
  if (!(await ownedCase(parsed.data.caseId, organizationId))) return missing;
  const id = String(form.get("id") || "");
  const data = { ...parsed.data, startsAt: new Date(parsed.data.startsAt) };
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const existing = id
          ? await tx.appointment.findFirst({
              where: { id, case: { organizationId } },
            })
          : null;
        if (id && !existing) return "missing";
        const owner = existing?.advisorId ?? advisorId;
        if (data.status === "SCHEDULED") {
          const candidates = await tx.appointment.findMany({
            where: {
              advisorId: owner,
              case: { organizationId },
              status: "SCHEDULED",
              id: id ? { not: id } : undefined,
              startsAt: {
                gt: new Date(data.startsAt.getTime() - 240 * 60000),
                lt: new Date(
                  data.startsAt.getTime() + data.durationMinutes * 60000,
                ),
              },
            },
          });
          if (
            candidates.some((v) =>
              intervalsOverlap(
                data.startsAt,
                data.durationMinutes,
                v.startsAt,
                v.durationMinutes,
              ),
            )
          )
            return "overlap";
        }
        if (id) await tx.appointment.update({ where: { id }, data });
        else await tx.appointment.create({ data: { ...data, advisorId } });
        return "saved";
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (result === "missing") return missing;
    if (result === "overlap")
      return {
        error: "כבר קיימת פגישה ביומן היועץ בשעות האלה. יש לבחור שעה אחרת.",
      };
  } catch {
    return failed;
  }
  refresh();
  return { success: "הפגישה נשמרה ביומן." };
}
