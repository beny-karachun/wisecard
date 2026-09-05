// Israeli mortgage tracks (מסלולים) and the Bank of Israel composition rules.
// Default rates are editable in the UI; live BOI/CBS data overrides them.

export type TrackType =
  | "PRIME"
  | "FIXED_UNLINKED"
  | "FIXED_LINKED"
  | "VARIABLE_UNLINKED"
  | "VARIABLE_LINKED"
  | "MAKAM"
  | "ELIGIBILITY";

export interface TrackDef {
  type: TrackType;
  label: string; // Hebrew
  linked: boolean; // principal indexed to CPI (מדד)
  fixed: boolean; // counts toward the "≥ ⅓ fixed" rule
  isPrime: boolean; // descriptive exposure; the regulatory cap applies to ALL variable tracks
  resetMonths: number | null;
  variable: boolean; // rate can move (stressed in the risk scenario)
  inOptimizer: boolean; // searched by default (niche tracks are manual-only)
  defaultRate: number; // annual nominal % (real % for linked tracks)
}

export const TRACKS: TrackDef[] = [
  {
    type: "PRIME",
    label: "פריים",
    linked: false,
    fixed: false,
    isPrime: true,
    resetMonths: 1,
    variable: true,
    inOptimizer: true,
    defaultRate: 6.0,
  },
  {
    type: "FIXED_UNLINKED",
    label: "קבועה לא צמודה (קל״צ)",
    linked: false,
    fixed: true,
    isPrime: false,
    resetMonths: null,
    variable: false,
    inOptimizer: true,
    defaultRate: 5.0,
  },
  {
    type: "FIXED_LINKED",
    label: "קבועה צמודה",
    linked: true,
    fixed: true,
    isPrime: false,
    resetMonths: null,
    variable: false,
    inOptimizer: true,
    defaultRate: 3.2,
  },
  {
    type: "VARIABLE_UNLINKED",
    label: "משתנה לא צמודה (כל 5)",
    linked: false,
    fixed: false,
    isPrime: false,
    resetMonths: 60,
    variable: true,
    inOptimizer: true,
    defaultRate: 5.3,
  },
  {
    type: "VARIABLE_LINKED",
    label: "משתנה צמודה (כל 5)",
    linked: true,
    fixed: false,
    isPrime: false,
    resetMonths: 60,
    variable: true,
    inOptimizer: true,
    defaultRate: 3.0,
  },
  {
    type: "MAKAM",
    label: "מסלול מק״מ (משתנה שנתית)",
    linked: false,
    fixed: false,
    isPrime: false,
    resetMonths: 12,
    variable: true,
    inOptimizer: false,
    defaultRate: 5.6,
  },
  {
    type: "ELIGIBILITY",
    label: "זכאות (משרד השיכון)",
    linked: true,
    fixed: true,
    isPrime: false,
    resetMonths: null,
    variable: false,
    inOptimizer: false,
    defaultRate: 3.0,
  },
];

export const TRACK_BY_TYPE: Record<TrackType, TrackDef> = Object.fromEntries(
  TRACKS.map((t) => [t.type, t]),
) as Record<TrackType, TrackDef>;

// Illustrative, editable assumption; not a CPI forecast.
export const DEFAULT_CPI = 2.5;
export const VARIABLE_MAX_PCT = 66.66;
export const FIXED_MIN_FRACTION = (100 - VARIABLE_MAX_PCT) / 100;
export const PTI_MAX = 0.5;
export const MAX_TERM_MONTHS = 360;
export const MAX_PRINCIPAL = 100_000_000;
export const RULES_REVIEWED_ON = "2026-09-05";
export const HOUSING_PTI_CHANGE_DATE = "2026-10-01";
export const RULES_SOURCE = "https://www.boi.org.il/media/hjrlkrse/h2852.pdf";
export type LtvBasis =
  "FIRST_HOME" | "UPGRADER" | "INVESTMENT" | "REFINANCE" | "CONSOLIDATION";
// null means that a single fixed LTV limit cannot determine eligibility.
export const LTV_CAPS: Record<LtvBasis, number | null> = {
  FIRST_HOME: 0.75,
  UPGRADER: 0.7,
  INVESTMENT: 0.5,
  REFINANCE: null,
  CONSOLIDATION: 0.5,
};
export function maximumLoan(
  value: number,
  basis: LtvBasis,
  concession = false,
): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  if (basis === "REFINANCE") return null;
  if (basis === "CONSOLIDATION" && concession)
    return Math.min(value * 0.7, value * 0.5 + 200_000);
  return value * LTV_CAPS[basis]!;
}
export const STRESS_RATE_BUMP = 2;
export const STRESS_CPI_BUMP = 1.5;
// Shock boundary: the first affected period is month 61 (after five full years).
export const STRESS_MONTH = 60;
