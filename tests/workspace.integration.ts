/** Run against a local dev server: WORKSPACE_INTEGRATION=1 node --import tsx tests/workspace.integration.ts.
 * Creates isolated synthetic organizations and removes only those fixtures in finally.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { simulate } from "../src/lib/mortgage/engine";
import { readSnapshot } from "../src/lib/mortgage/snapshot";

const loadModule = createRequire(import.meta.url);
const { encodeReply } = loadModule(
  "next/dist/compiled/react-server-dom-turbopack/client.node",
);

const base = process.env.WORKSPACE_TEST_URL || "http://127.0.0.1:3000";
if (
  process.env.WORKSPACE_INTEGRATION !== "1" ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname)
)
  throw new Error(
    "Explicit integration opt-in and a localhost server are required.",
  );
const prisma = new PrismaClient();
const orgIds: string[] = [];
const cookies = new Map<string, string>();
let assertions = 0;
function check(value: unknown, message: string) {
  assert.ok(value, message);
  assertions++;
}
async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cookie", [...cookies].map(([k, v]) => `${k}=${v}`).join("; "));
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers,
    redirect: "manual",
  });
  for (const cookie of res.headers.getSetCookie()) {
    const [pair] = cookie.split(";");
    const equals = pair.indexOf("=");
    cookies.set(pair.slice(0, equals), pair.slice(equals + 1));
  }
  return res;
}
async function action(
  name: string,
  path: string,
  fields: Record<string, string>,
  stateful = true,
) {
  const fieldsData = new FormData();
  for (const [key, value] of Object.entries(fields)) fieldsData.set(key, value);
  return rawAction(name, path, stateful ? [{}, fieldsData] : [fieldsData]);
}
async function rawAction(name: string, path: string, args: unknown[]) {
  const manifest = JSON.parse(
    await readFile(".next/dev/server/server-reference-manifest.json", "utf8"),
  );
  const entry = Object.entries(manifest.node).find(
    ([, v]) => (v as { exportedName?: string }).exportedName === name,
  );
  assert.ok(entry, `Registered action: ${name}`);
  const body = await encodeReply(args);
  const response = await request(path, {
    method: "POST",
    headers: {
      "Next-Action": entry[0],
      Origin: base,
      Accept: "text/x-component",
    },
    body,
  });
  const text = await response.text();
  assert.ok(response.status < 500, `${name} returned ${response.status}`);
  if (process.env.WORKSPACE_TEST_DEBUG === "1")
    console.log(name, text.slice(0, 2000));
  return text;
}

async function main() {
  try {
    const anonymous = await fetch(`${base}/app`, { redirect: "manual" });
    check(
      anonymous.status >= 300 && anonymous.status < 400,
      "Anonymous workspace is protected",
    );
    const suffix = randomUUID();
    const password = randomUUID();
    const org = await prisma.organization.create({
      data: { name: "בדיקת מערכת זמנית", slug: `qa-${suffix}` },
    });
    orgIds.push(org.id);
    const other = await prisma.organization.create({
      data: { name: "בדיקת בידוד זמנית", slug: `qa-other-${suffix}` },
    });
    orgIds.push(other.id);
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `qa-${suffix}@example.invalid`,
        name: "בודק זמני",
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
    const contact = await prisma.contact.create({
      data: { organizationId: org.id, name: "לקוח בדיקה זמני" },
    });
    const foreignContact = await prisma.contact.create({
      data: { organizationId: other.id, name: `private-${suffix}` },
    });
    const kase = await prisma.case.create({
      data: {
        organizationId: org.id,
        contactId: contact.id,
        title: "תיק בדיקה זמני",
        amount: 1000000,
      },
    });
    const foreign = await prisma.case.create({
      data: {
        organizationId: other.id,
        contactId: foreignContact.id,
        title: `foreign-${suffix}`,
        amount: 900000,
      },
    });
    const csrf = await (await request("/api/auth/csrf")).json();
    await request("/api/auth/callback/credentials", {
      method: "POST",
      body: new URLSearchParams({
        csrfToken: csrf.csrfToken,
        email: user.email,
        password,
        callbackUrl: `${base}/app`,
      }),
    });
    const session = await (await request("/api/auth/session")).json();
    check(session.user?.id === user.id, "Credentials authentication works");
    const path = `/app/cases/${kase.id}`;
    check((await request(path)).status === 200, "Case detail renders");
    const workflow = {
      caseId: kase.id,
      title: "תיק שעודכן בבדיקה",
      purpose: "PURCHASE",
      amount: "1000000",
      feeAgreed: "10000",
      feePaid: "2500",
      nextAction: "קבלת מסמכים",
      followUpAt: "2026-09-05",
      expectedCompletion: "2026-12-01",
      notes: "הערת בדיקה",
    };
    await action("saveCaseWorkflow", path, workflow);
    check(
      (await prisma.case.findUniqueOrThrow({ where: { id: kase.id } }))
        .feePaid === 2500,
      "Workflow action persists fees",
    );
    await action("saveCaseWorkflow", path, { ...workflow, feePaid: "10001" });
    check(
      (await prisma.case.findUniqueOrThrow({ where: { id: kase.id } }))
        .feePaid === 2500,
      "Invalid overpayment does not persist",
    );
    await action("saveCaseWorkflow", path, { ...workflow, caseId: foreign.id });
    check(
      (await prisma.case.findUniqueOrThrow({ where: { id: foreign.id } }))
        .feePaid === 0,
      "Cross-office case update denied",
    );
    await action("initializeDocuments", path, { caseId: kase.id });
    const count = await prisma.caseDocument.count({
      where: { caseId: kase.id },
    });
    await action("initializeDocuments", path, { caseId: kase.id });
    check(
      count > 0 &&
        (await prisma.caseDocument.count({ where: { caseId: kase.id } })) ===
          count,
      "Document initialization is idempotent",
    );
    await action("saveDocument", path, {
      caseId: kase.id,
      title: "מסמך בדיקה",
      status: "VERIFIED",
      url: "https://example.com/test",
    });
    check(
      (await prisma.caseDocument.count({
        where: { caseId: kase.id, title: "מסמך בדיקה", status: "VERIFIED" },
      })) === 1,
      "Document action persists review status",
    );
    await action("saveDocument", path, {
      caseId: foreign.id,
      title: "אסור",
      status: "MISSING",
    });
    check(
      (await prisma.caseDocument.count({ where: { caseId: foreign.id } })) ===
        0,
      "Cross-office document creation denied",
    );
    await action("saveDocument", path, {
      caseId: kase.id,
      title: "unsafe",
      status: "RECEIVED",
      url: "not-a-url",
    });
    check(
      (await prisma.caseDocument.count({
        where: { caseId: kase.id, title: "unsafe" },
      })) === 0,
      "Invalid URL returns safely without persistence",
    );
    const quote = {
      caseId: kase.id,
      bank: "בנק א לבדיקה",
      status: "APPROVED",
      amount: "1000000",
      termMonths: "360",
      firstPayment: "5500",
      totalPayment: "1800000",
      selected: "on",
      validUntil: "2099-01-01",
      tracks: JSON.stringify([
        { type: "FIXED_UNLINKED", amount: 1000000, rate: 4.5, termMonths: 360 },
      ]),
    };
    await action("saveBankOffer", path, quote);
    await action("saveBankOffer", path, { ...quote, bank: "בנק ב לבדיקה" });
    check(
      (await prisma.bankOffer.count({ where: { caseId: kase.id } })) === 2,
      "Bank offers persist",
    );
    check(
      (await prisma.bankOffer.count({
        where: { caseId: kase.id, selected: true },
      })) === 1,
      "Only one bank offer remains selected",
    );
    const selected = await prisma.bankOffer.findFirstOrThrow({
      where: { caseId: kase.id, selected: true },
    });
    await action("saveBankOffer", path, {
      ...quote,
      caseId: foreign.id,
      id: selected.id,
      bank: "cross-office",
    });
    check(
      (await prisma.bankOffer.findUniqueOrThrow({ where: { id: selected.id } }))
        .bank === "בנק ב לבדיקה",
      "Cross-office offer reassignment denied",
    );
    await request("/app/calendar");
    const appointment = {
      caseId: kase.id,
      title: "פגישת בדיקה זמנית",
      startsAt: "2099-01-05T09:00:00Z",
      durationMinutes: "60",
      status: "SCHEDULED",
      location: "משרד בדיקה",
    };
    await action("saveAppointment", "/app/calendar", appointment);
    await action("saveAppointment", "/app/calendar", {
      ...appointment,
      startsAt: "2099-01-05T09:30:00Z",
    });
    check(
      (await prisma.appointment.count({ where: { caseId: kase.id } })) === 1,
      "Overlapping appointment blocked",
    );
    await action("saveAppointment", "/app/calendar", {
      ...appointment,
      startsAt: "2099-01-05T10:00:00Z",
    });
    check(
      (await prisma.appointment.count({ where: { caseId: kase.id } })) === 2,
      "Adjacent appointment allowed",
    );
    await action("saveAppointment", "/app/calendar", {
      ...appointment,
      caseId: foreign.id,
    });
    check(
      (await prisma.appointment.count({ where: { caseId: foreign.id } })) === 0,
      "Cross-office appointment creation denied",
    );
    for (const route of [
      "/app",
      "/app/cases",
      "/app/contacts",
      path,
      "/app/documents",
      "/app/banks",
      "/app/calendar",
      "/app/calendar?history=1",
      "/app/fees",
      "/app/tasks",
      "/app/simulator",
    ]) {
      const response = await request(route);
      const html = await response.text();
      check(
        response.status === 200 &&
          !html.includes("לא הצלחנו לטעון את הנתונים") &&
          !html.includes("NEXT_REDIRECT"),
        `${route} renders successfully`,
      );
      check(
        !html.includes(foreignContact.name),
        `${route} does not expose other office`,
      );
    }
    const simulatorPath = `/app/simulator?caseId=${kase.id}`;
    const simulatorHtml = await (await request(simulatorPath)).text();
    check(
      simulatorHtml.includes("לוח סילוקין") &&
        simulatorHtml.includes("הבדיקה חלקית"),
      "Simulator renders schedule and missing-data status",
    );
    const simulation = simulate({
      amount: 1000000,
      termMonths: 241,
      cpi: 2.75,
      legs: [
        { type: "FIXED_UNLINKED", pct: 40, rate: 4.5, termMonths: 180 },
        { type: "PRIME", pct: 30, rate: 5.5, termMonths: 241 },
        { type: "FIXED_LINKED", pct: 30, rate: 3.1, termMonths: 201 },
      ],
      constraints: {
        monthlyIncome: 30000,
        monthlyObligations: 1000,
        propertyValue: 2000000,
        ltvBasis: "FIRST_HOME",
        existingHousingBalance: 0,
        existingHousingPayment: 0,
        approvalDate: "2026-10-01",
      },
      stress: { afterMonth: 36, rateBump: 3, cpiBump: 1 },
      monthlyInsurance: 170,
      upfrontCosts: 6200,
    });
    const payload = {
      caseId: kase.id,
      label: "תמהיל בדיקה מאומת",
      simulation: simulation.input,
      firstPayment: 1,
      totalPaid: 1,
      feasible: false,
    };
    await rawAction("saveScenario", simulatorPath, [payload]);
    const saved = await prisma.scenario.findFirstOrThrow({
      where: { caseId: kase.id, label: payload.label },
    });
    check(
      saved.firstPayment ===
        Math.round(simulation.result.firstPayment * 100) / 100 &&
        saved.totalPaid ===
          Math.round(simulation.result.totalPaid * 100) / 100 &&
        saved.feasible,
      "Scenario server recomputes totals and checks, ignoring browser values",
    );
    check(
      JSON.stringify(readSnapshot(saved.snapshot)) ===
        JSON.stringify(simulation.input),
      "All scenario assumptions persist exactly",
    );
    const report = await request(`/report/${saved.id}`);
    const reportHtml = await report.text();
    check(
      report.status === 200 &&
        reportHtml.includes("הנחות החישוב השמורות") &&
        reportHtml.includes("2026-10-01") &&
        reportHtml.includes("241") &&
        !reportHtml.includes("NEXT_REDIRECT"),
      "Versioned report renders saved inputs and exact months",
    );
    const restored = await (
      await request(`/app/simulator?scenarioId=${saved.id}`)
    ).text();
    check(
      restored.includes("נטענו ההנחות של התמהיל השמור") &&
        restored.includes("תמהיל בדיקה מאומת"),
      "Saved simulation reopens for editing",
    );
    const invalidResult = await rawAction("saveScenario", simulatorPath, [
      {
        ...payload,
        label: "invalid",
        simulation: {
          ...simulation.input,
          legs: [{ ...simulation.input.legs[0], pct: 99.6 }],
        },
      },
    ]);
    check(
      invalidResult.includes("100%") &&
        (await prisma.scenario.count({ where: { caseId: kase.id } })) === 1,
      "Invalid allocation returns error and never persists",
    );
    await rawAction("saveScenario", simulatorPath, [
      { ...payload, caseId: foreign.id },
    ]);
    check(
      (await prisma.scenario.count({ where: { caseId: foreign.id } })) === 0,
      "Cross-office scenario creation denied",
    );
    const legacy = await prisma.scenario.create({
      data: {
        organizationId: org.id,
        caseId: kase.id,
        label: "תמהיל ישן לבדיקה",
        amount: 1000000,
        termMonths: 241,
        cpi: 2,
        firstPayment: 1234,
        totalPaid: 1234567,
        feasible: true,
        legs: simulation.input.legs,
      },
    });
    const legacyHtml = await (await request(`/report/${legacy.id}`)).text();
    check(
      legacyHtml.includes("חישוב לא מאומת") &&
        !legacyHtml.includes("סיכום שנתי"),
      "Legacy report separates historical figures from new calculations",
    );
    const foreignScenario = await prisma.scenario.create({
      data: {
        organizationId: other.id,
        caseId: foreign.id,
        label: `private-scenario-${suffix}`,
        amount: 900000,
        termMonths: 240,
        cpi: 2,
        firstPayment: 5000,
        totalPaid: 1200000,
        feasible: false,
        legs: [],
      },
    });
    for (const route of [
      `/report/${foreignScenario.id}`,
      `/app/simulator?scenarioId=${foreignScenario.id}`,
      `/app/simulator?caseId=${foreign.id}`,
    ]) {
      const html = await (await request(route)).text();
      check(
        !html.includes(foreignScenario.label!) &&
          !html.includes(foreignContact.name),
        `${route} conceals other-office inputs`,
      );
    }
    const hugeInput = simulate({
      ...simulation.input,
      amount: 100000000,
      cpi: 15,
      termMonths: 360,
      legs: [{ type: "FIXED_LINKED", pct: 100, rate: 30 }],
    });
    check(
      hugeInput.result.totalPaid > 2147483647,
      "Large valid result exceeds legacy integer range",
    );
    await rawAction("saveScenario", simulatorPath, [
      {
        caseId: kase.id,
        label: "large-value",
        simulation: hugeInput.input,
        feasible: true,
      },
    ]);
    const hugeSaved = await prisma.scenario.findFirstOrThrow({
      where: { caseId: kase.id, label: "large-value" },
    });
    check(
      hugeSaved.totalPaid ===
        Math.round(hugeInput.result.totalPaid * 100) / 100 &&
        !hugeSaved.feasible,
      "Large totals persist without overflow and failed checks cannot be forged",
    );
    const hiddenCase = await request(`/app/cases/${foreign.id}`);
    check(
      !(await hiddenCase.text()).includes(foreignContact.name),
      "Foreign detail route hides data",
    );
    const calendar = await request("/app/calendar/export");
    const ics = await calendar.text();
    check(
      calendar.headers.get("content-type")?.startsWith("text/calendar") &&
        ics.includes("BEGIN:VEVENT") &&
        !ics.includes(foreignContact.name),
      "Authenticated calendar exports only own office",
    );
    console.log(`Passed ${assertions} authenticated HTTP/database assertions.`);
  } finally {
    for (const id of [...orgIds].reverse())
      await prisma.organization.delete({ where: { id } });
    await prisma.$disconnect();
    console.log("Removed isolated integration fixtures.");
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
