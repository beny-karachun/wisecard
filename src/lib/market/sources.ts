// Live data fetchers for the financial-data center.
// - Bank of Israel "Edge" SDMX API (policy rate + avg mortgage rates/anchors)
// - Central Bureau of Statistics (CPI / מדד המחירים לצרכן)
// Both are free, public, open-data APIs.

const BOI_URL =
  "https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/BR/1.0/?format=csv&lastNObservations=1";

const BOI_RATE_SERIES = "MNT_RIB_BOI_D"; // Bank of Israel policy rate (ריבית בנק ישראל)

// Housing-loan interest rates & anchors (ריביות וביצועים לדיור), monthly.
const BOI_MRTG_URL =
  "https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/BIR_MRTG_99/1.0/?format=csv&lastNObservations=13";

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

// Average new-mortgage rates and the variable-track anchors (עוגנים), from the
// BIR_MRTG_99 dataflow. Selected by dimensions: housing loans (BS_ITEM=A2C),
// all PTI buckets (P01), new lending (BIR_COVERAGE=N).
// DATA_TYPE: R = avg rate, RB = anchor (ריבית עוגן), RM = margin (מרווח).
const ANCHOR_SELECTORS: {
  idx: string; // INDEXATION_TYPE: NI = לא צמודה, CPI = צמודה
  irfv: string; // IR_FV_TYPE: F = fixed, V = variable
  dtype: string;
  series: string;
}[] = [
  { idx: "NI", irfv: "F", dtype: "R", series: "MTG_AVG_FIXED_UNLINKED" },
  { idx: "CPI", irfv: "F", dtype: "R", series: "MTG_AVG_FIXED_LINKED" },
  { idx: "NI", irfv: "V", dtype: "RB", series: "MTG_ANCHOR_VARIABLE_UNLINKED" },
  { idx: "NI", irfv: "V", dtype: "RM", series: "MTG_MARGIN_VARIABLE_UNLINKED" },
  { idx: "CPI", irfv: "V", dtype: "RB", series: "MTG_ANCHOR_VARIABLE_LINKED" },
  { idx: "CPI", irfv: "V", dtype: "RM", series: "MTG_MARGIN_VARIABLE_LINKED" },
];

export interface AnchorReading {
  series: string;
  date: string; // YYYY-MM-01
  value: number; // annual %
}

/** Minimal quoted-field-aware CSV line splitter. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export async function fetchMortgageAnchors(): Promise<AnchorReading[]> {
  try {
    const res = await fetch(BOI_MRTG_URL, {
      headers: { Accept: "text/csv" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const text = await res.text();
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const header = splitCsvLine(lines[0]);
    const col = (name: string) => header.indexOf(name);
    const idxCol = col("INDEXATION_TYPE");
    const irfvCol = col("IR_FV_TYPE");
    const dtypeCol = col("DATA_TYPE");
    const bsCol = col("BS_ITEM");
    const ptiCol = col("PTI");
    const covCol = col("BIR_COVERAGE");
    const chnCol = col("INT_CHN_PER");
    const dateCol = col("TIME_PERIOD");
    const valCol = col("OBS_VALUE");
    if ([idxCol, irfvCol, dtypeCol, bsCol, ptiCol, dateCol, valCol].some((c) => c < 0)) {
      return [];
    }

    const out: AnchorReading[] = [];
    for (const line of lines.slice(1)) {
      const cols = splitCsvLine(line);
      if (cols[bsCol] !== "A2C" || cols[ptiCol] !== "P01") continue;
      if (covCol >= 0 && cols[covCol] !== "N") continue;
      if (chnCol >= 0 && cols[chnCol] !== "A") continue;
      const sel = ANCHOR_SELECTORS.find(
        (s) =>
          s.idx === cols[idxCol] &&
          s.irfv === cols[irfvCol] &&
          s.dtype === cols[dtypeCol],
      );
      if (!sel) continue;
      const value = Number(cols[valCol]);
      const period = cols[dateCol]; // "YYYY-MM"
      if (!Number.isFinite(value) || !/^\d{4}-\d{2}$/.test(period)) continue;
      out.push({ series: sel.series, date: `${period}-01`, value });
    }
    return out;
  } catch {
    return [];
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
