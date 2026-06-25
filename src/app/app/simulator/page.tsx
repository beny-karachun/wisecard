import { Simulator } from "./simulator";

export default async function SimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ amount?: string; caseId?: string }>;
}) {
  const { amount, caseId } = await searchParams;
  const parsed = amount ? Number(amount) : NaN;
  const initialAmount =
    Number.isFinite(parsed) && parsed > 0 ? parsed : 1_200_000;
  return <Simulator initialAmount={initialAmount} caseId={caseId} />;
}
