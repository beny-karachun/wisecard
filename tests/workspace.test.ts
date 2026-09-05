import { test } from "node:test";
import assert from "node:assert/strict";
import {
  offerSchema,
  caseWorkflowSchema,
  documentSchema,
  appointmentSchema,
  documentChecklist,
  documentNeedsAttention,
  israelDate,
  intervalsOverlap,
} from "../src/lib/workspace";
import { buildCalendar } from "../src/lib/calendar";

const offer = {
  caseId: "case-a",
  bank: "בנק בדיקה",
  banker: null,
  phone: null,
  status: "APPROVED",
  amount: 1000000,
  termMonths: 360,
  firstPayment: 5500,
  totalPayment: 1800000,
  validUntil: "2099-01-01",
  selected: false,
  tracks: [],
  url: null,
  notes: null,
};
const track = {
  type: "FIXED_UNLINKED",
  amount: 1000000,
  rate: 4.5,
  termMonths: 360,
};
test("bank offers accept complete quotes, including zero-interest tracks", () => {
  assert.equal(
    offerSchema.safeParse({ ...offer, tracks: [{ ...track, rate: 0 }] })
      .success,
    true,
  );
});
test("quote tracks must reconcile with amount and longest term", () => {
  assert.equal(
    offerSchema.safeParse({ ...offer, tracks: [{ ...track, amount: 900000 }] })
      .success,
    false,
  );
  assert.equal(
    offerSchema.safeParse({ ...offer, tracks: [{ ...track, termMonths: 300 }] })
      .success,
    false,
  );
  assert.equal(
    offerSchema.safeParse({
      ...offer,
      tracks: [
        { ...track, amount: 400000, termMonths: 240 },
        { ...track, amount: 600000 },
      ],
    }).success,
    true,
  );
});
test("reject selected unapproved or expired quotes", () => {
  assert.equal(
    offerSchema.safeParse({ ...offer, selected: true, status: "SUBMITTED" })
      .success,
    false,
  );
  assert.equal(
    offerSchema.safeParse({
      ...offer,
      selected: true,
      validUntil: "2000-01-01",
    }).success,
    false,
  );
  assert.equal(
    offerSchema.safeParse({
      ...offer,
      selected: true,
      validUntil: israelDate(),
    }).success,
    true,
  );
});
test("reject malformed quote numbers and excessive tracks", () => {
  for (const amount of [-1, 0, 2.5, Infinity, 2147483648])
    assert.equal(offerSchema.safeParse({ ...offer, amount }).success, false);
  assert.equal(
    offerSchema.safeParse({ ...offer, tracks: Array(11).fill(track) }).success,
    false,
  );
  assert.equal(
    offerSchema.safeParse({ ...offer, tracks: [{ ...track, rate: -1 }] })
      .success,
    false,
  );
});
test("documents reject unsafe URLs and invalid dates", () => {
  const doc = {
    caseId: "a",
    title: "תעודת זהות",
    status: "RECEIVED",
    url: "https://example.com/document",
    expiresAt: "2026-12-01",
    notes: null,
  };
  assert.equal(documentSchema.safeParse(doc).success, true);
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "http://example.com",
    "not-a-link",
  ])
    assert.equal(documentSchema.safeParse({ ...doc, url }).success, false);
  assert.equal(
    documentSchema.safeParse({ ...doc, expiresAt: "2026-02-30" }).success,
    false,
  );
  assert.equal(
    documentSchema.safeParse({ ...doc, url: "", expiresAt: "" }).success,
    true,
  );
});
test("received docs need review; verified expired docs need attention", () => {
  assert.equal(
    documentNeedsAttention({ status: "RECEIVED", expiresAt: null }),
    true,
  );
  assert.equal(
    documentNeedsAttention({ status: "VERIFIED", expiresAt: null }),
    false,
  );
  assert.equal(
    documentNeedsAttention(
      { status: "VERIFIED", expiresAt: new Date("2026-09-05") },
      "2026-09-05",
    ),
    false,
  );
  assert.equal(
    documentNeedsAttention(
      { status: "VERIFIED", expiresAt: new Date("2026-09-04") },
      "2026-09-05",
    ),
    true,
  );
  assert.equal(
    documentNeedsAttention({
      status: "NOT_REQUIRED",
      expiresAt: new Date("2020-01-01"),
    }),
    false,
  );
});
test("checklists follow purchase versus refinance workflows without duplicate titles", () => {
  assert.ok(documentChecklist("REFINANCE").includes("דוח יתרות לסילוק"));
  assert.ok(!documentChecklist("REFINANCE").includes("חוזה רכישה"));
  assert.ok(documentChecklist("PURCHASE").includes("חוזה רכישה"));
  for (const purpose of ["PURCHASE", "REFINANCE", "EQUITY", "OTHER"] as const)
    assert.equal(
      new Set(documentChecklist(purpose)).size,
      documentChecklist(purpose).length,
    );
});
test("fees reject overpayment and allow fully paid cases", () => {
  const kase = {
    caseId: "a",
    title: "רכישה",
    purpose: "PURCHASE",
    amount: 1000000,
    feeAgreed: 10000,
    feePaid: 10000,
    followUpAt: null,
    expectedCompletion: null,
    nextAction: null,
    notes: null,
  };
  assert.equal(caseWorkflowSchema.safeParse(kase).success, true);
  assert.equal(
    caseWorkflowSchema.safeParse({ ...kase, feePaid: 10001 }).success,
    false,
  );
  assert.equal(
    caseWorkflowSchema.safeParse({ ...kase, feeAgreed: -1 }).success,
    false,
  );
});
test("Israel date uses local day at UTC midnight boundaries and DST", () => {
  assert.equal(israelDate(new Date("2026-09-04T22:30:00Z")), "2026-09-05");
  assert.equal(israelDate(new Date("2026-01-04T21:30:00Z")), "2026-01-04");
});
test("appointment validation requires an unambiguous timestamp and bounded duration", () => {
  const meeting = {
    caseId: "a",
    title: "פגישה",
    startsAt: "2026-09-06T09:00:00Z",
    durationMinutes: 60,
    status: "SCHEDULED",
    location: null,
    notes: null,
  };
  assert.equal(appointmentSchema.safeParse(meeting).success, true);
  assert.equal(
    appointmentSchema.safeParse({ ...meeting, startsAt: "2026-09-06T12:00" })
      .success,
    false,
  );
  for (const durationMinutes of [0, 241, -30, 30.5])
    assert.equal(
      appointmentSchema.safeParse({ ...meeting, durationMinutes }).success,
      false,
    );
});
test("overlap detection covers containing events but permits adjacent appointments", () => {
  const at = (hour: string) => new Date(`2026-09-06T${hour}:00Z`);
  assert.equal(intervalsOverlap(at("09:00"), 60, at("09:30"), 30), true);
  assert.equal(intervalsOverlap(at("09:30"), 30, at("09:00"), 120), true);
  assert.equal(intervalsOverlap(at("09:00"), 60, at("10:00"), 60), false);
  assert.equal(intervalsOverlap(at("11:00"), 60, at("09:00"), 60), false);
});
test("calendar export escapes injection, preserves UTF-8 and stable IDs", () => {
  const event = {
    id: "test-event",
    title: "פגישה ארוכה בעברית ".repeat(10),
    startsAt: new Date("2026-09-06T09:00Z"),
    durationMinutes: 60,
    updatedAt: new Date("2026-09-05T12:00Z"),
    location: "משרד; תל אביב",
    status: "CANCELLED",
    description: "שם, לקוח\nEND:VEVENT\nBEGIN:VEVENT",
  };
  const ics = buildCalendar([event]);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.ok(ics.includes("UID:test-event@wisecard"));
  assert.ok(ics.includes("DTEND:20260906T100000Z"));
  assert.ok(ics.includes("STATUS:CANCELLED"));
  assert.equal(ics.split("\r\nBEGIN:VEVENT").length, 2);
  for (const line of ics.split("\r\n"))
    assert.ok(Buffer.byteLength(line, "utf8") <= 75);
  assert.ok(ics.replace(/\r\n /g, "").includes(event.title));
});
