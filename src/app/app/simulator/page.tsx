import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Simulator } from "./simulator";
import { getMarketSnapshot, getMortgageMarket } from "@/lib/market/sync";
import { defaultRates } from "@/lib/mortgage/engine";
import { DEFAULT_CPI, TRACKS, type TrackType } from "@/lib/mortgage/tracks";
import { simulationSchema } from "@/lib/mortgage/input";
import { readSnapshot } from "@/lib/mortgage/snapshot";

export default async function SimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{
    amount?: string;
    caseId?: string;
    scenarioId?: string;
  }>;
}) {
  const query = await searchParams;
  const { organizationId } = await requireUser();
  const saved = query.scenarioId
    ? await prisma.scenario.findFirst({
        where: { id: query.scenarioId, organizationId },
      })
    : null;
  if (query.scenarioId && !saved) notFound();
  const caseId = saved?.caseId ?? query.caseId;
  const kase = caseId
    ? await prisma.case.findFirst({
        where: { id: caseId, organizationId },
        include: { contact: true, borrowers: true, property: true },
      })
    : null;
  if (caseId && !kase) notFound();
  const [snap, mtg, cases] = await Promise.all([
    getMarketSnapshot(),
    getMortgageMarket(),
    prisma.case.findMany({
      where: { organizationId },
      select: { id: true, title: true, contact: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const rates = defaultRates();
  const references: Partial<Record<TrackType, { value: number; date: Date }>> =
    {
      PRIME:
        snap.prime != null && snap.boiDate
          ? { value: snap.prime, date: snap.boiDate }
          : undefined,
      FIXED_UNLINKED: mtg.fixedUnlinked ?? undefined,
      FIXED_LINKED: mtg.fixedLinked ?? undefined,
      VARIABLE_UNLINKED: mtg.variableUnlinked ?? undefined,
      VARIABLE_LINKED: mtg.variableLinked ?? undefined,
    };
  const now = new Date();
  const rateNotes = TRACKS.map((t) => {
    const ref = references[t.type];
    if (
      ref &&
      Number.isFinite(ref.value) &&
      ref.value >= 0 &&
      ref.value <= 30
    ) {
      rates[t.type] = ref.value;
      const stale = now.getTime() - ref.date.getTime() > 120 * 86400000;
      return `${t.label}: ${ref.value}% · נתון ייחוס במאגר ל־${ref.date.toISOString().slice(0, 10)}${t.type === "PRIME" ? " (ריבית בנק ישראל + 1.5 נקודות אחוז, ללא מרווח לקוח)" : " (ממוצע / עוגן ומרווח; תאריך הרכיב הישן מביניהם)"}${stale ? " · הנתון בן יותר מ־120 יום — מומלץ לעדכן" : ""}`;
    }
    return `${t.label}: ${t.defaultRate}% · הנחת המחשה, ללא נתון שוק זמין`;
  });
  const approvalDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const requested = Number(query.amount);
  const initial = simulationSchema.parse({
    amount:
      Number.isInteger(requested) && requested > 0 && requested <= 100_000_000
        ? requested
        : kase?.amount || 1_200_000,
    termMonths: 300,
    cpi: DEFAULT_CPI,
    legs: [
      { type: "FIXED_UNLINKED", pct: 40, rate: rates.FIXED_UNLINKED },
      { type: "PRIME", pct: 30, rate: rates.PRIME },
      { type: "FIXED_LINKED", pct: 30, rate: rates.FIXED_LINKED },
    ],
    constraints: {
      approvalDate,
      monthlyIncome: kase?.borrowers.length
        ? kase.borrowers.reduce((s, b) => s + b.monthlyIncome, 0)
        : undefined,
      monthlyObligations: kase?.borrowers.length
        ? kase.borrowers.reduce((s, b) => s + b.monthlyObligations, 0)
        : undefined,
      propertyValue: kase?.property?.value,
      ltvBasis: kase?.property?.ltvBasis,
    },
  });
  const snapshot = readSnapshot(saved?.snapshot);
  const legacy =
    saved && !snapshot
      ? simulationSchema.safeParse({
          ...initial,
          amount: saved.amount,
          termMonths: saved.termMonths,
          cpi: saved.cpi,
          legs: saved.legs,
        })
      : null;
  return (
    <Simulator
      key={saved?.id ?? kase?.id ?? "new"}
      initialInput={snapshot ?? (legacy?.success ? legacy.data : initial)}
      initialRates={rates}
      initialCaseId={kase?.id ?? ""}
      initialLabel={saved?.label ?? "תמהיל מוצע"}
      caseOptions={cases.map((c) => ({
        id: c.id,
        label: c.title || c.contact.name,
      }))}
      rateNotes={rateNotes}
      historicalCpi={
        snap.cpiYoY == null
          ? undefined
          : `${snap.cpiYoY}% · ${snap.cpiDate?.toISOString().slice(0, 10) ?? "ללא תאריך"}`
      }
      restored={!!snapshot}
      legacyNotice={!!saved && !snapshot}
    />
  );
}
