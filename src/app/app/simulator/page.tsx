import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Simulator } from "./simulator";
import { getMarketSnapshot, getMortgageMarket } from "@/lib/market/sync";
import { defaultRates } from "@/lib/mortgage/engine";
import { DEFAULT_CPI } from "@/lib/mortgage/tracks";

export default async function SimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ amount?: string; caseId?: string }>;
}) {
  const { amount, caseId } = await searchParams;
  const { organizationId } = await requireUser();

  // When opened from a case, seed the simulator with its financials.
  const kase = caseId
    ? await prisma.case.findFirst({
        where: { id: caseId, organizationId },
        include: {
          contact: { select: { name: true } },
          borrowers: true,
          property: true,
        },
      })
    : null;

  const parsed = amount ? Number(amount) : NaN;
  const initialAmount =
    Number.isFinite(parsed) && parsed > 0
      ? parsed
      : (kase?.amount ?? 1_200_000);

  const income = kase
    ? kase.borrowers.reduce((s, b) => s + b.monthlyIncome, 0)
    : 0;
  const obligations = kase
    ? kase.borrowers.reduce((s, b) => s + b.monthlyObligations, 0)
    : 0;

  // Seed the simulator with live market data where available.
  const [snap, mtg] = await Promise.all([
    getMarketSnapshot(),
    getMortgageMarket(),
  ]);
  const rates = defaultRates();
  if (snap.prime != null) rates.PRIME = snap.prime;
  if (mtg.fixedUnlinked) rates.FIXED_UNLINKED = mtg.fixedUnlinked.value;
  if (mtg.fixedLinked) rates.FIXED_LINKED = mtg.fixedLinked.value;
  if (mtg.variableUnlinked) rates.VARIABLE_UNLINKED = mtg.variableUnlinked.value;
  if (mtg.variableLinked) rates.VARIABLE_LINKED = mtg.variableLinked.value;
  const initialCpi = snap.cpiYoY ?? DEFAULT_CPI;

  return (
    <Simulator
      initialAmount={initialAmount}
      caseId={kase?.id}
      caseName={kase ? (kase.title ?? kase.contact.name) : undefined}
      initialIncome={income > 0 ? income : undefined}
      initialObligations={obligations > 0 ? obligations : undefined}
      initialPropertyValue={kase?.property?.value}
      initialLtvBasis={kase?.property?.ltvBasis}
      initialRates={rates}
      initialCpi={initialCpi}
    />
  );
}
