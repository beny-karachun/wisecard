import { Simulator } from "./simulator";
import { getMarketSnapshot } from "@/lib/market/sync";
import { defaultRates } from "@/lib/mortgage/engine";
import { DEFAULT_CPI } from "@/lib/mortgage/tracks";

export default async function SimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ amount?: string; caseId?: string }>;
}) {
  const { amount, caseId } = await searchParams;
  const parsed = amount ? Number(amount) : NaN;
  const initialAmount =
    Number.isFinite(parsed) && parsed > 0 ? parsed : 1_200_000;

  // Seed the simulator with live market data where available.
  const snap = await getMarketSnapshot();
  const rates = defaultRates();
  if (snap.prime != null) rates.PRIME = snap.prime;
  const initialCpi = snap.cpiYoY ?? DEFAULT_CPI;

  return (
    <Simulator
      initialAmount={initialAmount}
      caseId={caseId}
      initialRates={rates}
      initialCpi={initialCpi}
    />
  );
}
