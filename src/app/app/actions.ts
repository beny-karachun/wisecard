"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  scenarioInputSchema,
  ENGINE_VERSION,
  inputError,
} from "@/lib/mortgage/input";
import { simulate } from "@/lib/mortgage/engine";
import { documentChecklist } from "@/lib/workspace";
import { syncMarketData } from "@/lib/market/sync";

// Empty form fields ("") become undefined.
function str(v: FormDataEntryValue | null): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

const contactSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(["LEAD", "CLIENT"]),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  source: z.string().trim().optional(),
});

export async function createContact(formData: FormData) {
  const { organizationId } = await requireUser();
  const data = contactSchema.parse({
    name: str(formData.get("name")),
    type: str(formData.get("type")) ?? "LEAD",
    phone: str(formData.get("phone")),
    email: str(formData.get("email")),
    source: str(formData.get("source")),
  });

  const contact = await prisma.contact.create({
    data: { ...data, organizationId },
  });

  revalidatePath("/app/contacts");
  revalidatePath("/app");
  redirect(`/app/contacts/${contact.id}`);
}

export async function updateContact(formData: FormData) {
  const { organizationId } = await requireUser();
  const id = str(formData.get("id"));
  if (!id) return;

  const data = contactSchema.parse({
    name: str(formData.get("name")),
    type: str(formData.get("type")) ?? "LEAD",
    phone: str(formData.get("phone")),
    email: str(formData.get("email")),
    source: str(formData.get("source")),
  });

  await prisma.contact.updateMany({
    where: { id, organizationId },
    data: {
      name: data.name,
      type: data.type,
      phone: data.phone ?? null,
      email: data.email ?? null,
      source: data.source ?? null,
    },
  });

  revalidatePath(`/app/contacts/${id}`);
  revalidatePath("/app/contacts");
  revalidatePath("/app");
}

export async function convertContact(id: string) {
  const { organizationId } = await requireUser();
  await prisma.contact.updateMany({
    where: { id, organizationId },
    data: { type: "CLIENT" },
  });
  revalidatePath(`/app/contacts/${id}`);
  revalidatePath("/app/contacts");
  revalidatePath("/app");
}

export async function deleteContact(id: string) {
  const { organizationId } = await requireUser();
  await prisma.contact.deleteMany({ where: { id, organizationId } });
  revalidatePath("/app/contacts");
  revalidatePath("/app");
  redirect("/app/contacts");
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

const caseSchema = z.object({
  contactId: z.string().min(1),
  title: z.string().trim().optional(),
  purpose: z.enum(["PURCHASE", "REFINANCE", "EQUITY", "OTHER"]),
  amount: z.coerce.number().int().nonnegative().optional(),
});

export async function createCase(formData: FormData) {
  const { organizationId } = await requireUser();
  const data = caseSchema.parse({
    contactId: str(formData.get("contactId")),
    title: str(formData.get("title")),
    purpose: str(formData.get("purpose")) ?? "PURCHASE",
    amount: str(formData.get("amount")),
  });

  // Ensure the contact belongs to this org before linking.
  const contact = await prisma.contact.findFirst({
    where: { id: data.contactId, organizationId },
    select: { id: true },
  });
  if (!contact) redirect("/app/cases");

  const created = await prisma.case.create({
    data: {
      organizationId,
      contactId: data.contactId,
      title: data.title ?? null,
      purpose: data.purpose,
      amount: data.amount ?? null,
      documents: {
        create: documentChecklist(data.purpose).map((title) => ({ title })),
      },
    },
  });

  revalidatePath("/app/cases");
  revalidatePath("/app");
  redirect(`/app/cases/${created.id}`);
}

const CASE_STATUSES = [
  "NEW",
  "IN_PROGRESS",
  "SUBMITTED",
  "APPROVED",
  "CLOSED",
  "LOST",
] as const;

export async function updateCaseStatus(caseId: string, status: string) {
  const { organizationId } = await requireUser();
  const parsed = z.enum(CASE_STATUSES).parse(status);
  await prisma.case.updateMany({
    where: { id: caseId, organizationId },
    data: { status: parsed },
  });
  revalidatePath(`/app/cases/${caseId}`);
  revalidatePath("/app/cases");
  revalidatePath("/app");
}

export async function deleteCase(id: string) {
  const { organizationId } = await requireUser();
  await prisma.case.deleteMany({ where: { id, organizationId } });
  revalidatePath("/app/cases");
  revalidatePath("/app");
  redirect("/app/cases");
}

// ---------------------------------------------------------------------------
// Borrowers & property (the case's household financials)
// ---------------------------------------------------------------------------

const borrowerSchema = z.object({
  caseId: z.string().min(1),
  name: z.string().trim().min(1),
  monthlyIncome: z.coerce.number().int().nonnegative().default(0),
  monthlyObligations: z.coerce.number().int().nonnegative().default(0),
  employment: z.enum([
    "SALARIED",
    "SELF_EMPLOYED",
    "BUSINESS_OWNER",
    "PENSIONER",
    "OTHER",
  ]),
});

async function ownedCase(caseId: string, organizationId: string) {
  return prisma.case.findFirst({
    where: { id: caseId, organizationId },
    select: { id: true },
  });
}

export async function createBorrower(formData: FormData) {
  const { organizationId } = await requireUser();
  const data = borrowerSchema.parse({
    caseId: str(formData.get("caseId")),
    name: str(formData.get("name")),
    monthlyIncome: str(formData.get("monthlyIncome")) ?? 0,
    monthlyObligations: str(formData.get("monthlyObligations")) ?? 0,
    employment: str(formData.get("employment")) ?? "SALARIED",
  });

  if (!(await ownedCase(data.caseId, organizationId))) return;

  await prisma.borrower.create({ data });
  revalidatePath(`/app/cases/${data.caseId}`);
}

export async function updateBorrower(formData: FormData) {
  const { organizationId } = await requireUser();
  const id = str(formData.get("id"));
  if (!id) return;
  const data = borrowerSchema.parse({
    caseId: str(formData.get("caseId")),
    name: str(formData.get("name")),
    monthlyIncome: str(formData.get("monthlyIncome")) ?? 0,
    monthlyObligations: str(formData.get("monthlyObligations")) ?? 0,
    employment: str(formData.get("employment")) ?? "SALARIED",
  });

  await prisma.borrower.updateMany({
    where: { id, case: { organizationId } },
    data: {
      name: data.name,
      monthlyIncome: data.monthlyIncome,
      monthlyObligations: data.monthlyObligations,
      employment: data.employment,
    },
  });
  revalidatePath(`/app/cases/${data.caseId}`);
}

export async function deleteBorrower(id: string) {
  const { organizationId } = await requireUser();
  const borrower = await prisma.borrower.findFirst({
    where: { id, case: { organizationId } },
    select: { caseId: true },
  });
  if (!borrower) return;
  await prisma.borrower.delete({ where: { id } });
  revalidatePath(`/app/cases/${borrower.caseId}`);
}

const propertySchema = z.object({
  caseId: z.string().min(1),
  value: z.coerce.number().int().positive(),
  city: z.string().trim().optional(),
  type: z.enum(["APARTMENT", "HOUSE", "PENTHOUSE", "LAND", "OTHER"]),
  ltvBasis: z.enum([
    "FIRST_HOME",
    "UPGRADER",
    "INVESTMENT",
    "REFINANCE",
    "CONSOLIDATION",
  ]),
});

export async function upsertProperty(formData: FormData) {
  const { organizationId } = await requireUser();
  const data = propertySchema.parse({
    caseId: str(formData.get("caseId")),
    value: str(formData.get("value")),
    city: str(formData.get("city")),
    type: str(formData.get("type")) ?? "APARTMENT",
    ltvBasis: str(formData.get("ltvBasis")) ?? "FIRST_HOME",
  });

  if (!(await ownedCase(data.caseId, organizationId))) return;

  const fields = {
    value: data.value,
    city: data.city ?? null,
    type: data.type,
    ltvBasis: data.ltvBasis,
  };
  await prisma.property.upsert({
    where: { caseId: data.caseId },
    update: fields,
    create: { caseId: data.caseId, ...fields },
  });
  revalidatePath(`/app/cases/${data.caseId}`);
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

const taskSchema = z.object({
  title: z.string().trim().min(1),
  caseId: z.string().optional(),
  dueAt: z.string().optional(),
});

export async function createTask(formData: FormData) {
  const { organizationId, id: userId } = await requireUser();
  const data = taskSchema.parse({
    title: str(formData.get("title")),
    caseId: str(formData.get("caseId")),
    dueAt: str(formData.get("dueAt")),
  });

  if (data.caseId) {
    const owned = await prisma.case.findFirst({
      where: { id: data.caseId, organizationId },
      select: { id: true },
    });
    if (!owned) return;
  }

  await prisma.task.create({
    data: {
      organizationId,
      assigneeId: userId,
      caseId: data.caseId ?? null,
      title: data.title,
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
    },
  });

  if (data.caseId) revalidatePath(`/app/cases/${data.caseId}`);
  revalidatePath("/app/tasks");
  revalidatePath("/app");
}

export async function toggleTask(id: string) {
  const { organizationId } = await requireUser();
  const task = await prisma.task.findFirst({
    where: { id, organizationId },
    select: { done: true, caseId: true },
  });
  if (!task) return;

  await prisma.task.update({
    where: { id },
    data: { done: !task.done },
  });

  if (task.caseId) revalidatePath(`/app/cases/${task.caseId}`);
  revalidatePath("/app/tasks");
  revalidatePath("/app");
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

const activitySchema = z.object({
  body: z.string().trim().min(1),
  channel: z.enum(["NOTE", "CALL", "WHATSAPP", "EMAIL", "MEETING"]),
  contactId: z.string().optional(),
  caseId: z.string().optional(),
});

export async function createActivity(formData: FormData) {
  const { organizationId, id: userId } = await requireUser();
  const data = activitySchema.parse({
    body: str(formData.get("body")),
    channel: str(formData.get("channel")) ?? "NOTE",
    contactId: str(formData.get("contactId")),
    caseId: str(formData.get("caseId")),
  });

  // Verify ownership of whichever parent was supplied.
  if (data.contactId) {
    const owned = await prisma.contact.findFirst({
      where: { id: data.contactId, organizationId },
      select: { id: true },
    });
    if (!owned) return;
  }
  if (data.caseId) {
    const owned = await prisma.case.findFirst({
      where: { id: data.caseId, organizationId },
      select: { id: true },
    });
    if (!owned) return;
  }

  await prisma.activity.create({
    data: {
      organizationId,
      authorId: userId,
      contactId: data.contactId ?? null,
      caseId: data.caseId ?? null,
      channel: data.channel,
      body: data.body,
    },
  });

  if (data.contactId) revalidatePath(`/app/contacts/${data.contactId}`);
  if (data.caseId) revalidatePath(`/app/cases/${data.caseId}`);
}

// ---------------------------------------------------------------------------
// Scenarios (saved mortgage mixes)
// ---------------------------------------------------------------------------

export async function saveScenario(
  input: unknown,
): Promise<{ id?: string; error?: string }> {
  const { organizationId } = await requireUser();
  const parsed = scenarioInputSchema.safeParse(input);
  if (!parsed.success) return { error: inputError(parsed.error) };
  const data = parsed.data;
  const owned = await prisma.case.findFirst({
    where: { id: data.caseId, organizationId },
    select: { id: true },
  });
  if (!owned) return { error: "התיק לא נמצא במשרד שלך." };
  // Client-provided totals, flags and legacy fields never participate in saving.
  const computed = simulate(data.simulation);
  try {
    const saved = await prisma.scenario.create({
      data: {
        organizationId,
        caseId: owned.id,
        label: data.label,
        amount: computed.input.amount,
        termMonths: computed.result.termMonths,
        cpi: computed.input.cpi,
        firstPayment: Math.round(computed.result.firstPayment * 100) / 100,
        totalPaid: Math.round(computed.result.totalPaid * 100) / 100,
        feasible: computed.result.assessment === "pass",
        legs: computed.input.legs,
        snapshot: { version: ENGINE_VERSION, input: computed.input },
      },
    });
    revalidatePath(`/app/cases/${owned.id}`);
    return { id: saved.id };
  } catch {
    return { error: "התמהיל לא נשמר. אפשר לנסות שוב." };
  }
}

export async function deleteScenario(id: string) {
  const { organizationId } = await requireUser();
  const scenario = await prisma.scenario.findFirst({
    where: { id, organizationId },
    select: { caseId: true },
  });
  await prisma.scenario.deleteMany({ where: { id, organizationId } });
  if (scenario?.caseId) revalidatePath(`/app/cases/${scenario.caseId}`);
}

// ---------------------------------------------------------------------------
// Market data
// ---------------------------------------------------------------------------

export async function refreshMarketData() {
  await requireUser();
  await syncMarketData();
  revalidatePath("/app/data");
  revalidatePath("/app/simulator");
}
