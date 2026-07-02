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
  isPrime: boolean; // counts toward the "≤ ⅔ prime" rule
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
    variable: false,
    inOptimizer: false,
    defaultRate: 3.0,
  },
];

export const TRACK_BY_TYPE: Record<TrackType, TrackDef> = Object.fromEntries(
  TRACKS.map((t) => [t.type, t]),
) as Record<TrackType, TrackDef>;

// Assumed annual CPI for linked tracks (within BOI's 1–3% target band).
export const DEFAULT_CPI = 2.5;

// Bank of Israel mortgage-composition rules (directive on housing-loan mix).
export const FIXED_MIN_FRACTION = 1 / 3; // ≥ ⅓ at a fixed rate
export const PRIME_MAX_FRACTION = 2 / 3; // ≤ ⅔ prime
export const PTI_MAX = 0.5; // (payment + obligations) / income ≤ 50%
export const MAX_TERM_MONTHS = 360; // 30 years

// Max loan-to-value per BOI directive, by purchase profile.
// Mirrors the Prisma `LtvBasis` enum.
export type LtvBasis = "FIRST_HOME" | "UPGRADER" | "INVESTMENT";

export const LTV_CAPS: Record<LtvBasis, number> = {
  FIRST_HOME: 0.75,
  UPGRADER: 0.7,
  INVESTMENT: 0.5,
};

// Stress scenario for the risk metric: variable rates +2pp, CPI +1.5pp,
// payment observed at year 5 (a common advisory rule of thumb).
export const STRESS_RATE_BUMP = 2;
export const STRESS_CPI_BUMP = 1.5;
export const STRESS_MONTH = 60;
