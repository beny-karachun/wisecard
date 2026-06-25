// Live data fetchers for the financial-data center.
// - Bank of Israel "Edge" SDMX API (interest rate)
// - Central Bureau of Statistics (CPI / מדד המחירים לצרכן)
// Both are free, public, open-data APIs.

const BOI_URL =
  "https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/BR/1.0/?format=csv&lastNObservations=1";

const BOI_RATE_SERIES = "MNT_RIB_BOI_D"; // Bank of Israel policy rate (ריבית בנק ישראל)

const CBS_CPI_URL = (last: number) =>
  `https://api.cbs.gov.il/index/data/price?id=120010&format=json&last=${last}`;

export interface BoiRate {
  date: string; // YYYY-MM-DD
  value: number; // annual %
}

export async function fetchBoiRate(): Promise<BoiRate | null> {
  try {
    const res = await fetch(BOI_URL, {
      headers: { Accept: "text/csv" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split("\n");
    if (lines.length < 2) return null;

    const header = lines[0].split(",");
    const codeIdx = header.indexOf("SERIES_CODE");
    const dateIdx = header.indexOf("TIME_PERIOD");
    const valIdx = header.indexOf("OBS_VALUE");
    if (codeIdx < 0 || dateIdx < 0 || valIdx < 0) return null;

    for (const line of lines.slice(1)) {
      const cols = line.split(",");
      if (cols[codeIdx] === BOI_RATE_SERIES) {
        const value = Number(cols[valIdx]);
        if (!Number.isFinite(value)) return null;
        return { date: cols[dateIdx], value };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export interface CpiReading {
  date: string; // YYYY-MM-01
  index: number; // index level
  yoy: number; // annual % change
  monthly: number; // monthly % change
}

export async function fetchCpi(last = 13): Promise<CpiReading[]> {
  try {
    const res = await fetch(CBS_CPI_URL(last), { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    const dates: unknown[] = json?.month?.[0]?.date ?? [];
    const out: CpiReading[] = [];
    for (const raw of dates) {
      const d = raw as {
        year: number;
        month: number;
        percent: number;
        percentYear: number;
        currBase?: { value?: number };
      };
      const index = d.currBase?.value;
      if (index == null) continue;
      out.push({
        date: `${d.year}-${String(d.month).padStart(2, "0")}-01`,
        index,
        yoy: d.percentYear,
        monthly: d.percent,
      });
    }
    return out;
  } catch {
    return [];
  }
}
