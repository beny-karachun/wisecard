import { prisma } from "@/lib/prisma";
import { fetchBoiRate, fetchCpi, fetchMortgageAnchors } from "./sources";

// Prime = Bank of Israel rate + a fixed spread (set by the banks, 1.5%).
export const PRIME_SPREAD = 1.5;

export interface SyncResult {
  boiRate: number | null;
  cpiMonths: number;
  anchorPoints: number;
}

/** Fetch live BOI rate + CPI + mortgage anchors and upsert into MarketReading. */
export async function syncMarketData(): Promise<SyncResult> {
  const result: SyncResult = { boiRate: null, cpiMonths: 0, anchorPoints: 0 };

  const boi = await fetchBoiRate();
  if (boi) {
    const date = new Date(boi.date);
    await prisma.marketReading.upsert({
      where: { series_date: { series: "BOI_RATE", date } },
      update: { value: boi.value },
      create: { series: "BOI_RATE", date, value: boi.value },
    });
    result.boiRate = boi.value;
  }

  const cpi = await fetchCpi();
  for (const c of cpi) {
    const date = new Date(c.date);
    await prisma.marketReading.upsert({
      where: { series_date: { series: "CPI_INDEX", date } },
      update: { value: c.index },
      create: { series: "CPI_INDEX", date, value: c.index },
    });
    await prisma.marketReading.upsert({
      where: { series_date: { series: "CPI_YOY", date } },
      update: { value: c.yoy },
      create: { series: "CPI_YOY", date, value: c.yoy },
    });
    result.cpiMonths++;
  }

  const anchors = await fetchMortgageAnchors();
  for (const a of anchors) {
    const date = new Date(a.date);
    await prisma.marketReading.upsert({
      where: { series_date: { series: a.series, date } },
      update: { value: a.value },
      create: { series: a.series, date, value: a.value },
    });
    result.anchorPoints++;
  }

  return result;
}

export interface MarketSnapshot {
  boiRate: number | null;
  prime: number | null;
  cpiYoY: number | null;
  cpiIndex: number | null;
  boiDate: Date | null;
  cpiDate: Date | null;
  updatedAt: Date | null;
}

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const [boi, cpiYoY, cpiIndex] = await Promise.all([
    prisma.marketReading.findFirst({
      where: { series: "BOI_RATE" },
      orderBy: { date: "desc" },
    }),
    prisma.marketReading.findFirst({
      where: { series: "CPI_YOY" },
      orderBy: { date: "desc" },
    }),
    prisma.marketReading.findFirst({
      where: { series: "CPI_INDEX" },
      orderBy: { date: "desc" },
    }),
  ]);

  const boiRate = boi?.value ?? null;
  return {
    boiRate,
    prime: boiRate != null ? Math.round((boiRate + PRIME_SPREAD) * 100) / 100 : null,
    cpiYoY: cpiYoY?.value ?? null,
    cpiIndex: cpiIndex?.value ?? null,
    boiDate: boi?.date ?? null,
    cpiDate: cpiYoY?.date ?? null,
    updatedAt:
      [boi?.createdAt, cpiYoY?.createdAt]
        .filter(Boolean)
        .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0] ?? null,
  };
}

export interface MortgageRate {
  value: number; // annual %
  date: Date;
  anchor?: number; // for variable tracks: עוגן
  margin?: number; // for variable tracks: מרווח
}

export interface MortgageMarket {
  fixedUnlinked: MortgageRate | null; // avg קל"צ on new mortgages
  fixedLinked: MortgageRate | null; // avg קבועה צמודה
  variableUnlinked: MortgageRate | null; // anchor + margin, משתנה לא צמודה
  variableLinked: MortgageRate | null; // anchor + margin, משתנה צמודה
}

async function latestReading(series: string) {
  return prisma.marketReading.findFirst({
    where: { series },
    orderBy: { date: "desc" },
  });
}

/** Latest average mortgage rates / anchors, for the data center + simulator. */
export async function getMortgageMarket(): Promise<MortgageMarket> {
  const [fixedUnlinked, fixedLinked, anchorVU, marginVU, anchorVL, marginVL] =
    await Promise.all([
      latestReading("MTG_AVG_FIXED_UNLINKED"),
      latestReading("MTG_AVG_FIXED_LINKED"),
      latestReading("MTG_ANCHOR_VARIABLE_UNLINKED"),
      latestReading("MTG_MARGIN_VARIABLE_UNLINKED"),
      latestReading("MTG_ANCHOR_VARIABLE_LINKED"),
      latestReading("MTG_MARGIN_VARIABLE_LINKED"),
    ]);

  const round2 = (v: number) => Math.round(v * 100) / 100;
  const variable = (
    anchor: typeof anchorVU,
    margin: typeof marginVU,
  ): MortgageRate | null =>
    anchor && margin
      ? {
          value: round2(anchor.value + margin.value),
          date: anchor.date,
          anchor: anchor.value,
          margin: margin.value,
        }
      : null;

  return {
    fixedUnlinked: fixedUnlinked
      ? { value: fixedUnlinked.value, date: fixedUnlinked.date }
      : null,
    fixedLinked: fixedLinked
      ? { value: fixedLinked.value, date: fixedLinked.date }
      : null,
    variableUnlinked: variable(anchorVU, marginVU),
    variableLinked: variable(anchorVL, marginVL),
  };
}

export interface CpiRow {
  date: Date;
  index: number | null;
  yoy: number | null;
}

/** Last N months of CPI (index + annual %) for the data center table. */
export async function getCpiHistory(months = 12): Promise<CpiRow[]> {
  const rows = await prisma.marketReading.findMany({
    where: { series: { in: ["CPI_INDEX", "CPI_YOY"] } },
    orderBy: { date: "desc" },
    take: months * 2,
  });

  const byDate = new Map<number, CpiRow>();
  for (const r of rows) {
    const key = r.date.getTime();
    const row = byDate.get(key) ?? { date: r.date, index: null, yoy: null };
    if (r.series === "CPI_INDEX") row.index = r.value;
    if (r.series === "CPI_YOY") row.yoy = r.value;
    byDate.set(key, row);
  }

  return Array.from(byDate.values())
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, months);
}
