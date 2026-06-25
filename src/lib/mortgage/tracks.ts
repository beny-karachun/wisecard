// Israeli mortgage tracks (מסלולים) and the Bank of Israel composition rules.
// Default rates are editable in the UI; Phase 3 wires live BOI/CBS data.

export type TrackType =
  | "PRIME"
  | "FIXED_UNLINKED"
  | "FIXED_LINKED"
  | "VARIABLE_UNLINKED"
  | "VARIABLE_LINKED";

export interface TrackDef {
  type: TrackType;
  label: string; // Hebrew
  linked: boolean; // principal indexed to CPI (מדד)
  fixed: boolean; // counts toward the "≥ ⅓ fixed" rule
  isPrime: boolean; // counts toward the "≤ ⅔ prime" rule
  defaultRate: number; // annual nominal % (real % for linked tracks)
}

export const TRACKS: TrackDef[] = [
  {
    type: "PRIME",
    label: "פריים",
    linked: false,
    fixed: false,
    isPrime: true,
    defaultRate: 6.0,
  },
  {
    type: "FIXED_UNLINKED",
    label: "קבועה לא צמודה (קל״צ)",
    linked: false,
    fixed: true,
    isPrime: false,
    defaultRate: 5.0,
  },
  {
    type: "FIXED_LINKED",
    label: "קבועה צמודה",
    linked: true,
    fixed: true,
    isPrime: false,
    defaultRate: 3.2,
  },
  {
    type: "VARIABLE_UNLINKED",
    label: "משתנה לא צמודה (כל 5)",
    linked: false,
    fixed: false,
    isPrime: false,
    defaultRate: 5.3,
  },
  {
    type: "VARIABLE_LINKED",
    label: "משתנה צמודה (כל 5)",
    linked: true,
    fixed: false,
    isPrime: false,
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
export const PTI_MAX = 0.5; // payment-to-income ≤ 50%
export const MAX_TERM_MONTHS = 360; // 30 years
