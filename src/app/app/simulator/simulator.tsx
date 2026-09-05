"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Download,
  Play,
  X,
  BookmarkPlus,
  RotateCcw,
} from "lucide-react";
import { Panel, PageHeading, Badge } from "@/components/workspace/ui";
import { saveScenario } from "../actions";
import { formatCurrency as money } from "@/lib/format";
import { ltvBasisLabel } from "@/lib/labels";
import {
  TRACKS,
  TRACK_BY_TYPE,
  RULES_SOURCE,
  RULES_REVIEWED_ON,
  type TrackType,
} from "@/lib/mortgage/tracks";
import {
  simulate,
  annualMilestones,
  type SimulationInput,
  type SimulationResult,
  type MixResult,
  type RateMap,
  type OptimizeInput,
  type OptimizeResult,
} from "@/lib/mortgage/engine";

type Props = {
  initialInput: SimulationInput;
  initialRates: RateMap;
  initialCaseId: string;
  initialLabel: string;
  caseOptions: { id: string; label: string }[];
  rateNotes: string[];
  historicalCpi?: string;
  restored: boolean;
  legacyNotice: boolean;
};
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";
const primary = `${button} border-transparent bg-teal-700 text-white hover:bg-teal-800`;
const percent = (v: number | null) =>
  v == null ? "לא נבדק" : `${v.toFixed(1)}%`;
function Field({
  label,
  value,
  onChange,
  min,
  max,
  step = "any",
  hint,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number | "any";
  hint?: string;
}) {
  return (
    <label className="form-label">
      {label}
      <input
        className="form-input tabular-nums"
        dir="ltr"
        type="number"
        value={value == null || Number.isNaN(value) ? "" : value}
        onChange={(e) =>
          onChange(e.target.value === "" ? NaN : Number(e.target.value))
        }
        min={min}
        max={max}
        step={step}
      />
      {hint && (
        <span className="text-xs font-normal leading-5 text-slate-500">
          {hint}
        </span>
      )}
    </label>
  );
}
function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold tabular-nums text-slate-900">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>}
    </div>
  );
}
function Status({ result }: { result: MixResult }) {
  return (
    <Badge
      tone={
        result.assessment === "fail"
          ? "red"
          : result.assessment === "incomplete"
            ? "amber"
            : "teal"
      }
    >
      {result.assessment === "fail"
        ? "נמצאו חריגות בבדיקות הבסיסיות"
        : result.assessment === "incomplete"
          ? "הבדיקה חלקית — נדרשת השלמת נתונים / בחינה"
          : "עבר את הבדיקות הבסיסיות"}
    </Badge>
  );
}
function Assumptions() {
  return (
    <div className="space-y-2 text-xs leading-6 text-slate-500">
      <p>
        מודל שפיצר חודשי, ריבית שנתית נומינלית. הנחת המדד השנתית נצברת בריבית
        דריבית חודשית, מתחילת החודש הראשון. בתרחיש הבסיס הריביות נשארות קבועות.
        מסלולים מסתיימים במועד הפירעון שלהם.
      </p>
      <p>
        החישוב אינו כולל רצפת מדד חוזית, פיגור בפרסום המדד, תקופה ראשונה חלקית,
        גרייס, בלון או עמלת פירעון מוקדם. ביטוח ועלויות חד־פעמיות הם אומדן נפרד
        שהיועץ מזין. זכאות, מיחזור וחריגים דורשים בחינה פרטנית.
      </p>
      <p>
        זהו כלי תכנון, ולא הצעת בנק או אישור אשראי.{" "}
        <a
          className="text-teal-700 underline"
          href={RULES_SOURCE}
          target="_blank"
          rel="noreferrer"
        >
          כללי הבדיקה והוראת בנק ישראל
        </a>{" "}
        · נבדקו ב־{RULES_REVIEWED_ON}.
      </p>
    </div>
  );
}

export function Simulator(props: Props) {
  const [input, setInput] = useState(props.initialInput);
  const [caseId, setCaseId] = useState(props.initialCaseId);
  const [label, setLabel] = useState(props.initialLabel);
  const [saveMessage, setSaveMessage] = useState<{
    error?: string;
    id?: string;
    key?: string;
  }>({});
  const [saving, startSave] = useTransition();
  const [pinned, setPinned] = useState<
    { label: string; simulation: SimulationResult }[]
  >([]);
  const [searchTracks, setSearchTracks] = useState<TrackType[]>(
    TRACKS.filter((t) => t.inOptimizer).map((t) => t.type),
  );
  const [searchRates, setSearchRates] = useState<RateMap>(() => ({
    ...props.initialRates,
    ...Object.fromEntries(input.legs.map((l) => [l.type, l.rate])),
  }));
  const [step, setStep] = useState(5);
  const [search, setSearch] = useState<{
    key: string;
    result?: OptimizeResult;
    error?: string;
    running?: boolean;
  } | null>(null);
  const worker = useRef<Worker | null>(null);
  const [month, setMonth] = useState(1);
  const [tableMode, setTableMode] = useState<"annual" | "monthly">("annual");
  const [page, setPage] = useState(0);
  const computation = useMemo(() => {
    try {
      return { simulation: simulate(input), error: "" };
    } catch (error) {
      return {
        simulation: null,
        error: error instanceof Error ? error.message : "בדקו את הנתונים",
      };
    }
  }, [input]);
  const sim = computation.simulation;
  const result = sim?.result;
  const fingerprint = JSON.stringify({ input, caseId, label });
  const searchInput: OptimizeInput = {
    amount: input.amount,
    termMonths: input.termMonths,
    cpi: input.cpi,
    rates: {
      ...searchRates,
      ...Object.fromEntries(input.legs.map((l) => [l.type, l.rate])),
    },
    constraints: {
      ...input.constraints,
      terms: Object.fromEntries(
        input.legs.map((l) => [l.type, l.termMonths ?? input.termMonths]),
      ),
    },
    stress: input.stress,
    monthlyInsurance: input.monthlyInsurance,
    upfrontCosts: input.upfrontCosts,
    tracks: searchTracks,
    stepPct: step,
  };
  const searchKey = JSON.stringify(searchInput);
  const stale = search?.key !== searchKey;
  useEffect(
    () => () => {
      worker.current?.terminate();
      worker.current = null;
    },
    [searchKey],
  );
  const busy = !!search?.running && !stale;
  const update = <K extends keyof SimulationInput>(
    key: K,
    value: SimulationInput[K],
  ) => setInput((old) => ({ ...old, [key]: value }));
  const constraint = <K extends keyof SimulationInput["constraints"]>(
    key: K,
    value: SimulationInput["constraints"][K],
  ) =>
    setInput((old) => ({
      ...old,
      constraints: {
        ...old.constraints,
        [key]:
          typeof value === "number" && Number.isNaN(value) ? undefined : value,
      },
    }));
  function changeLeg(
    index: number,
    patch: Partial<SimulationInput["legs"][number]>,
  ) {
    setInput((old) => ({
      ...old,
      legs: old.legs.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }));
  }
  function apply(result: MixResult) {
    update(
      "legs",
      result.legs.map(({ type, pct, rate, termMonths }) => ({
        type,
        pct,
        rate,
        termMonths,
      })),
    );
  }
  function runSearch() {
    worker.current?.terminate();
    try {
      const instance = new Worker(
        new URL("./optimizer.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current = instance;
      setSearch({ key: searchKey, running: true });
      instance.onmessage = (
        e: MessageEvent<{
          key: string;
          result?: OptimizeResult;
          error?: string;
        }>,
      ) => {
        if (worker.current === instance) {
          setSearch(e.data);
          instance.terminate();
          worker.current = null;
        }
      };
      instance.onerror = () => {
        if (worker.current === instance) {
          setSearch({
            key: searchKey,
            error: "החיפוש לא הושלם. אפשר לנסות שוב עם פחות מסלולים.",
          });
          instance.terminate();
          worker.current = null;
        }
      };
      instance.postMessage({ key: searchKey, input: searchInput });
    } catch {
      setSearch({
        key: searchKey,
        error: "הדפדפן לא הצליח להפעיל את החיפוש. התמהיל הידני זמין.",
      });
    }
  }
  function download() {
    if (!sim) return;
    const data = [
      "חודש,תשלום בסיס,ריבית,הצמדה,קרן שנפרעה,יתרה,תשלום לחץ,יתרה בלחץ",
      ...sim.rows.map((r, i) =>
        [
          r.month,
          r.payment,
          r.interest,
          r.indexation,
          r.principal,
          r.balance,
          sim.stressRows[i].payment,
          sim.stressRows[i].balance,
        ]
          .map((n) => n.toFixed(2))
          .join(","),
      ),
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", data], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "mortgage-schedule.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const allocTotal = input.legs.reduce((s, l) => s + l.pct, 0);
  const selectedMonth = sim ? Math.min(month, sim.rows.length) : 1;
  const annual = sim ? annualMilestones(sim.rows) : [];
  const tableRows = sim ? (tableMode === "annual" ? annual : sim.rows) : [];
  const lastPage = Math.max(0, Math.ceil(tableRows.length / 12) - 1);
  const currentPage = Math.min(page, lastPage);
  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <PageHeading
        eyebrow="תכנון משכנתא"
        title="מהתמהיל לתמונה המלאה"
        description="בונים תמהיל, בודקים את ההחזר לאורך חיי ההלוואה ומשווים חלופות תחת אותן הנחות."
      />
      {props.restored && (
        <p className="rounded-xl bg-teal-50 p-4 text-sm text-teal-800">
          נטענו ההנחות של התמהיל השמור, לרבות תאריך הבחינה. שינויים יישמרו כעותק
          חדש.
        </p>
      )}
      {props.legacyNotice && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          זהו תמהיל מהגרסה הישנה. המסלולים התקינים נטענו לחישוב מחדש; יש לבדוק
          ולהשלים את הנחות משק הבית, האשראי הקיים והעלויות לפני שמירה חדשה.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <Panel title="01 · ההלוואה והנחות התכנון">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="סכום הלוואה · ₪"
              value={input.amount}
              onChange={(v) => update("amount", v)}
              min={1}
              max={100_000_000}
              step={1}
            />
            <Field
              label="תקופת ברירת מחדל · חודשים"
              value={input.termMonths}
              onChange={(v) => update("termMonths", v)}
              min={1}
              max={360}
              step={1}
              hint="למסלולים ללא תקופה נפרדת"
            />
            <Field
              label="הנחת מדד שנתית · %"
              value={input.cpi}
              onChange={(v) => update("cpi", v)}
              min={-5}
              max={15}
              hint="הנחת תכנון הניתנת לעריכה, לא תחזית"
            />
          </div>
          <details className="mt-5 border-t border-slate-100 pt-4">
            <summary className="cursor-pointer text-sm font-semibold text-teal-700">
              מקורות הריביות והנחות המודל
            </summary>
            <div className="mt-3 space-y-3">
              <p className="text-xs leading-6 text-slate-500">
                הריביות הן נקודת מוצא לעריכה. נתוני המאגר אינם הצעה ללקוח או
                נתון בזמן אמת; בדקו את תאריך כל סדרה. לתמהיל שנטען נשמרות
                הריביות שלו.
              </p>
              <ul className="list-inside list-disc space-y-1 text-xs text-slate-500">
                {props.rateNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              {props.historicalCpi && (
                <p className="text-xs text-slate-500">
                  מדד שנתי היסטורי במאגר: {props.historicalCpi}. אינו משמש
                  אוטומטית כהנחת המדד העתידי.
                </p>
              )}
              <Assumptions />
            </div>
          </details>
        </Panel>
        <Panel title="הוצאות מעבר להלוואה">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Field
              label="ביטוח חודשי משוער · ₪"
              value={input.monthlyInsurance}
              onChange={(v) => update("monthlyInsurance", v)}
              min={0}
            />
            <Field
              label="עלויות חד־פעמיות · ₪"
              value={input.upfrontCosts}
              onChange={(v) => update("upfrontCosts", v)}
              min={0}
            />
          </div>
          <p className="mt-3 text-xs leading-6 text-slate-500">
            למשל שמאות, פתיחת תיק ושכר ייעוץ. ההוצאות מוצגות בנפרד מתשלומי
            ההלוואה ומיחס ההחזר. הביטוח הונח קבוע עד סוף המסלול הארוך ביותר.
          </p>
        </Panel>
      </div>
      <Panel title="02 · בניית התמהיל">
        <div className="space-y-3">
          {input.legs.map((leg, i) => (
            <div
              key={leg.type}
              className="grid items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]"
            >
              <label className="form-label">
                מסלול
                <select
                  className="form-input"
                  value={leg.type}
                  onChange={(e) => {
                    const type = e.target.value as TrackType;
                    changeLeg(i, { type, rate: searchRates[type] });
                  }}
                >
                  {TRACKS.filter(
                    (t) =>
                      t.type === leg.type ||
                      !input.legs.some((l) => l.type === t.type),
                  ).map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-normal text-slate-500">
                  {TRACK_BY_TYPE[leg.type].linked ? "צמוד למדד" : "לא צמוד"} ·{" "}
                  {Number.isFinite(leg.pct) && Number.isFinite(input.amount)
                    ? money((input.amount * leg.pct) / 100)
                    : "—"}
                </span>
              </label>
              <Field
                label={`חלק · % (${i + 1})`}
                value={leg.pct}
                onChange={(v) => changeLeg(i, { pct: v })}
                min={0.01}
                max={100}
              />
              <Field
                label={`ריבית שנתית · % (${i + 1})`}
                value={leg.rate}
                onChange={(v) => changeLeg(i, { rate: v })}
                min={0}
                max={30}
              />
              <div>
                <Field
                  label={`תקופה · חודשים (${i + 1})`}
                  value={leg.termMonths ?? input.termMonths}
                  onChange={(v) => changeLeg(i, { termMonths: v })}
                  min={1}
                  max={360}
                  step={1}
                />
                {leg.termMonths != null && (
                  <button
                    className="mt-1 min-h-8 text-xs text-teal-700"
                    onClick={() => changeLeg(i, { termMonths: undefined })}
                  >
                    לפי ברירת המחדל
                  </button>
                )}
              </div>
              <button
                className={`${button} mt-5`}
                aria-label={`הסרת ${TRACK_BY_TYPE[leg.type].label}`}
                disabled={input.legs.length === 1}
                onClick={() =>
                  update(
                    "legs",
                    input.legs.filter((_, n) => n !== i),
                  )
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            className={button}
            disabled={input.legs.length === TRACKS.length}
            onClick={() => {
              const type = TRACKS.find(
                (t) => !input.legs.some((l) => l.type === t.type),
              )!.type;
              update("legs", [
                ...input.legs,
                {
                  type,
                  pct: Math.max(0, 100 - allocTotal),
                  rate: searchRates[type],
                },
              ]);
            }}
          >
            <Plus size={16} />
            הוספת מסלול
          </button>
          <Badge tone={Math.abs(allocTotal - 100) < 1e-7 ? "teal" : "red"}>
            סך הקצאה:{" "}
            {Number.isFinite(allocTotal)
              ? `${Number(allocTotal.toFixed(4))}%`
              : "—"}{" "}
            מתוך 100%
          </Badge>
        </div>
        {computation.error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {computation.error}
          </p>
        )}
      </Panel>
      <Panel title="03 · יכולת החזר ומימון">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field
            label="הכנסה חודשית מוכרת נטו · ₪"
            value={input.constraints.monthlyIncome}
            onChange={(v) => constraint("monthlyIncome", v)}
            min={0}
          />
          <Field
            label="הוצאות קבועות מוכרות · ₪"
            value={input.constraints.monthlyObligations}
            onChange={(v) => constraint("monthlyObligations", v)}
            min={0}
            hint="ללא תשלומי הדיור שמוזנים בנפרד להלן"
          />
          <Field
            label="שווי נכס מוכר לבנק · ₪"
            value={input.constraints.propertyValue}
            onChange={(v) => constraint("propertyValue", v)}
            min={0}
          />
          <label className="form-label">
            פרופיל מימון
            <select
              className="form-input"
              value={input.constraints.ltvBasis ?? ""}
              onChange={(e) =>
                constraint(
                  "ltvBasis",
                  (e.target.value ||
                    undefined) as SimulationInput["constraints"]["ltvBasis"],
                )
              }
            >
              <option value="">טרם הוגדר</option>
              {Object.entries(ltvBasisLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs leading-6 text-slate-500">
          הוצאות קבועות כוללות התחייבויות שיתרתן מעל 18 חודשים, מזונות ושכירות
          רלוונטית לפי כללי ההכרה. הזינו 0 כשאין הוצאות; שדה ריק משאיר את הבדיקה
          חלקית. יש לוודא הכרה בהכנסה וסיווג הוצאות בבנק.
        </p>
        <details className="mt-4 border-t border-slate-100 pt-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-teal-700">
            אשראי שיישאר בנכס ותאריך בחינה
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className="form-label">
              תאריך בחינת האישור
              <input
                type="date"
                className="form-input"
                value={input.constraints.approvalDate ?? ""}
                onChange={(e) =>
                  constraint("approvalDate", e.target.value || undefined)
                }
              />
            </label>
            <Field
              label="יתרת אשראי שתישאר בנכס · ₪"
              value={input.constraints.existingHousingBalance}
              onChange={(v) => constraint("existingHousingBalance", v)}
              min={0}
              hint="מכל הבנקים, ללא הסכום שממוחזר. הזינו 0 אם אין."
            />
            <Field
              label="החזר חודשי שיישאר בנכס · ₪"
              value={input.constraints.existingHousingPayment}
              onChange={(v) => constraint("existingHousingPayment", v)}
              min={0}
              hint="הלוואות דיור שיתרת תקופתן מעל 18 חודשים. הזינו 0 אם אין."
            />
            {(input.constraints.approvalDate ?? "") >= "2026-10-01" &&
              (input.constraints.existingHousingBalance ?? 0) > 0 && (
                <>
                  <Field
                    label="מתוך היתרה: באותו בנק · ₪"
                    value={input.constraints.sameBankBalance}
                    onChange={(v) => constraint("sameBankBalance", v)}
                    min={0}
                  />
                  <Field
                    label="מתוכה: בריבית משתנה · ₪"
                    value={input.constraints.sameBankVariableBalance}
                    onChange={(v) => constraint("sameBankVariableBalance", v)}
                    min={0}
                  />
                </>
              )}
            {input.constraints.ltvBasis === "REFINANCE" && (
              <Field
                label="יתרת ההלוואה שממוחזרת · ₪"
                value={input.constraints.refinanceBalance}
                onChange={(v) => constraint("refinanceBalance", v)}
                min={0}
              />
            )}
          </div>
          <p className="mt-3 text-xs leading-6 text-slate-500">
            מ־1.10.2026 תשלומי דיור שנותרים על אותו נכס נכללים במונה יחס ההחזר.
            לפני כן הם מופחתים מההכנסה הפנויה במודל. אין להזין אותם שוב בהוצאות
            הקבועות. תאריך הבחינה נשמר עם התמהיל.
          </p>
        </details>
        {input.constraints.ltvBasis === "CONSOLIDATION" && (
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 accent-teal-700"
              checked={input.constraints.consolidationConcession ?? false}
              onChange={(e) =>
                constraint("consolidationConcession", e.target.checked)
              }
            />
            בחינת ההקלה לכל מטרה: עד 70% מימון, ובכל מקרה עד 200,000 ₪ מעל 50%
            מהשווי. נדרש שיקול דעת של הבנק.
          </label>
        )}
        {result && (
          <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
            <Status result={result} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat
                label="הכנסה פנויה לחישוב"
                value={money(result.disposableIncome)}
              />
              <Stat label="יחס החזר התחלתי" value={percent(result.ptiPct)} />
              <Stat label="שיעור מימון כולל" value={percent(result.ltvPct)} />
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {result.checks.map((c) => (
                <li
                  key={c.key}
                  className={`rounded-lg p-3 text-xs leading-6 ${c.status === "fail" ? "bg-red-50 text-red-800" : c.status === "incomplete" ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-600"}`}
                >
                  <b>
                    {c.label} ·{" "}
                    {c.status === "fail"
                      ? "חריגה"
                      : c.status === "incomplete"
                        ? "להשלמה"
                        : "נבדק"}
                  </b>
                  <p>{c.detail}</p>
                </li>
              ))}
            </ul>
            {result.warnings.map((w) => (
              <p key={w} className="text-xs leading-6 text-amber-800">
                {w}
              </p>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="04 · מבחן לחץ">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="השינוי מתחיל לאחר חודש"
            value={input.stress.afterMonth}
            onChange={(v) =>
              update("stress", { ...input.stress, afterMonth: v })
            }
            min={0}
            max={360}
            step={1}
          />
          <Field
            label="תוספת לריבית · נקודות אחוז"
            value={input.stress.rateBump}
            onChange={(v) => update("stress", { ...input.stress, rateBump: v })}
            min={0}
            max={10}
          />
          <Field
            label="תוספת למדד השנתי · נקודות אחוז"
            value={input.stress.cpiBump}
            onChange={(v) => update("stress", { ...input.stress, cpiBump: v })}
            min={0}
            max={10}
          />
        </div>
        <p className="mt-3 text-xs leading-6 text-slate-500">
          המדד משתנה בחודש שאחרי נקודת השינוי. הריבית משתנה בתחנה הבאה: פריים
          מדי חודש, מק״מ מדי 12 חודשים ומשתנה כל 5 שנים מדי 60 חודשים, לפי תחילת
          ההלוואה. מסלולים קבועים אינם משנים ריבית.
        </p>
      </Panel>
      {sim && result && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="החזר הלוואה ראשון"
              value={money(result.firstPayment)}
              hint={`עם ביטוח: ${money(result.firstOutlay)}`}
            />
            <Stat
              label="שיא ההחזר בבסיס"
              value={money(result.peakPayment)}
              hint={`בחודש ${result.peakMonth} · לפני ביטוח`}
            />
            <Stat
              label="סך תשלומי הלוואה"
              value={money(result.totalPaid)}
              hint={`ריבית ${money(result.totalInterest)} · הצמדה ${money(result.totalIndexation)}`}
            />
            <Stat
              label="סך הוצאה כולל"
              value={money(result.totalOutlay)}
              hint="הלוואה, ביטוח ועלויות חד־פעמיות"
            />
          </div>
          <Panel title="התזרים לאורך חיי ההלוואה">
            <CashFlow sim={sim} />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat
                label={`החזר בלחץ · חודש ${result.stressObservationMonth}`}
                value={money(result.stressedPayment)}
                hint={`יחס החזר בחודש זה: ${percent(result.stressedPtiPct)}`}
              />
              <Stat
                label="שיא ההחזר בתרחיש לחץ"
                value={money(result.stressedPeakPayment)}
                hint="לאורך כל חיי ההלוואה, לפני ביטוח"
              />
              <Stat
                label="סך תשלומי הלוואה בלחץ"
                value={money(result.stressedTotalPaid)}
                hint={`שינוי מול הבסיס: ${money(result.stressedTotalPaid - result.totalPaid)}`}
              />
            </div>
            <label className="mt-5 block text-sm font-semibold">
              בחינת חודש {selectedMonth}
              <input
                className="mt-3 w-full accent-teal-700"
                type="range"
                min={1}
                max={sim.rows.length}
                value={selectedMonth}
                onChange={(e) => setMonth(Number(e.target.value))}
              />
            </label>
            <p className="text-sm leading-7 text-slate-600">
              בסיס: {money(sim.rows[selectedMonth - 1].payment)} · לחץ:{" "}
              {money(sim.stressRows[selectedMonth - 1].payment)} · יתרה בבסיס:{" "}
              {money(sim.rows[selectedMonth - 1].balance)} · יתרה בלחץ:{" "}
              {money(sim.stressRows[selectedMonth - 1].balance)}
            </p>
          </Panel>
          <Panel title="לוח סילוקין">
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                className={button}
                aria-pressed={tableMode === "annual"}
                onClick={() => {
                  setTableMode("annual");
                  setPage(0);
                }}
              >
                סיכום שנתי
              </button>
              <button
                className={button}
                aria-pressed={tableMode === "monthly"}
                onClick={() => {
                  setTableMode("monthly");
                  setPage(0);
                }}
              >
                חודשי
              </button>
              <button className={`${button} ms-auto`} onClick={download}>
                <Download size={16} />
                ייצוא CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-right text-sm tabular-nums">
                <caption className="pb-3 text-right text-xs text-slate-500">
                  {tableMode === "annual"
                    ? "התשלומים, הריבית וההצמדה הם סיכום לתקופה; היתרה בסופה. השנה האחרונה עשויה להיות חלקית."
                    : "תשלומי ההלוואה בלבד, ללא ביטוח ועלויות חד־פעמיות. הסכומים מעוגלים לתצוגה."}
                </caption>
                <thead>
                  <tr className="border-b text-xs text-slate-500">
                    {["חודש", "תשלומים", "ריבית", "הצמדה", "יתרה בסוף"].map(
                      (h) => (
                        <th className="py-3 font-medium" key={h}>
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {tableRows
                    .slice(currentPage * 12, (currentPage + 1) * 12)
                    .map((r) => (
                      <tr key={r.month} className="border-b border-slate-100">
                        <td className="py-3">{r.month}</td>
                        <td>{money("paid" in r ? r.paid : r.payment)}</td>
                        <td>{money(r.interest)}</td>
                        <td>{money(r.indexation)}</td>
                        <td>{money(r.balance)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button
                className={button}
                disabled={!currentPage}
                onClick={() => setPage(currentPage - 1)}
              >
                הקודם
              </button>
              <span className="text-xs text-slate-500">
                עמוד {currentPage + 1} מתוך {lastPage + 1}
              </span>
              <button
                className={button}
                disabled={currentPage === lastPage}
                onClick={() => setPage(currentPage + 1)}
              >
                הבא
              </button>
            </div>
          </Panel>
        </>
      )}
      <Panel title="05 · חיפוש חלופות">
        <p className="mb-4 text-sm leading-6 text-slate-500">
          חיפוש ברשת הקצאות קבועה, בריביות ובתקופות המוצגות. זה אינו חיפוש בכל
          התמהילים האפשריים או הצעת בנק. חלופות שחסרים להן נתונים עדיין עשויות
          להופיע; חלופות שנכשלו בבדיקה בסיסית מסוננות.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {TRACKS.filter((t) => t.type !== "ELIGIBILITY").map((t) => {
            const active = input.legs.find((l) => l.type === t.type);
            return (
              <div
                key={t.type}
                className="rounded-lg border border-slate-200 p-3"
              >
                <label className="flex min-h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-teal-700"
                    checked={searchTracks.includes(t.type)}
                    onChange={(e) =>
                      setSearchTracks((old) =>
                        e.target.checked
                          ? [...old, t.type]
                          : old.filter((type) => type !== t.type),
                      )
                    }
                  />
                  {t.label}
                </label>
                {active ? (
                  <p className="text-xs leading-6 text-slate-500">
                    {active.rate}% · {active.termMonths ?? input.termMonths}{" "}
                    חודשים · לפי התמהיל
                  </p>
                ) : (
                  <Field
                    label={`ריבית לחיפוש · ${t.label}`}
                    value={searchRates[t.type]}
                    onChange={(v) =>
                      setSearchRates((old) => ({ ...old, [t.type]: v }))
                    }
                    min={0}
                    max={30}
                    hint={`${input.termMonths} חודשים · תקופת ברירת המחדל`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="form-label">
            צעד הקצאה
            <select
              className="form-input"
              value={step}
              onChange={(e) => setStep(Number(e.target.value))}
            >
              <option value={5}>5% · חיפוש מפורט</option>
              <option value={10}>10% · חיפוש מהיר</option>
            </select>
          </label>
          <button
            className={primary}
            disabled={!sim || busy || !searchTracks.length}
            onClick={runSearch}
          >
            <Play size={16} />
            {busy ? "מחפש חלופות…" : "חיפוש חלופות"}
          </button>
          {busy && (
            <button
              className={button}
              onClick={() => {
                worker.current?.terminate();
                worker.current = null;
                setSearch(null);
              }}
            >
              <X size={16} />
              ביטול
            </button>
          )}
        </div>
        <div aria-live="polite">
          {search && stale && (
            <p className="mt-4 text-sm text-amber-800">
              ההנחות השתנו. הפעילו חיפוש מחדש כדי לקבל חלופות מעודכנות.
            </p>
          )}
          {search?.error && !stale && (
            <p role="alert" className="mt-4 text-sm text-red-700">
              {search.error}
            </p>
          )}
          {search?.result && !stale && (
            <>
              <p className="my-4 text-xs text-slate-500">
                נבחנו {search.result.evaluated.toLocaleString("he-IL")} הקצאות
                בצעד {search.result.stepPct}%;{" "}
                {search.result.feasibleCount.toLocaleString("he-IL")} ללא חריגה
                בבדיקות שבוצעו.
              </p>
              {!search.result.feasibleCount && (
                <p className="text-sm text-amber-800">
                  לא נמצאה חלופה ללא חריגה בטווח החיפוש. בדקו את סכום המימון,
                  יכולת ההחזר והמסלולים שנבחרו.
                </p>
              )}
              <div className="grid gap-3 md:grid-cols-3">
                {(
                  [
                    ["סך הוצאה נמוך", search.result.byCost],
                    ["החזר ראשון נמוך", search.result.byPayment],
                    ["שיא החזר בלחץ נמוך", search.result.byRisk],
                  ] as const
                ).map(
                  ([title, candidate]) =>
                    candidate && (
                      <div
                        className="space-y-3 rounded-xl border border-slate-200 p-4"
                        key={title}
                      >
                        <h3 className="font-bold">{title}</h3>
                        <Status result={candidate} />
                        <p className="text-sm">
                          החזר ראשון {money(candidate.firstPayment)}
                          <br />
                          סך הוצאה {money(candidate.totalOutlay)}
                          <br />
                          שיא בלחץ {money(candidate.stressedPeakPayment)}
                        </p>
                        <p className="text-xs leading-6 text-slate-500">
                          {candidate.legs
                            .map(
                              (l) => `${TRACK_BY_TYPE[l.type].label} ${l.pct}%`,
                            )
                            .join(" · ")}
                        </p>
                        <button
                          className={button}
                          onClick={() => apply(candidate)}
                        >
                          החלת החלופה
                        </button>
                      </div>
                    ),
                )}
              </div>
            </>
          )}
        </div>
      </Panel>
      <Panel title="השוואה ושמירה">
        <div className="grid items-end gap-4 md:grid-cols-[1fr_1fr_auto]">
          <label className="form-label">
            שם התמהיל
            <input
              className="form-input"
              value={label}
              maxLength={120}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label className="form-label">
            תיק לשמירה
            <select
              className="form-input"
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
            >
              <option value="">בחירת תיק</option>
              {props.caseOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className={primary}
            disabled={!sim || !caseId || !label.trim() || saving}
            onClick={() => {
              if (!sim) return;
              const key = fingerprint;
              setSaveMessage({});
              startSave(async () => {
                try {
                  const response = await saveScenario({
                    caseId,
                    label,
                    simulation: sim.input,
                  });
                  setSaveMessage({ ...response, key });
                } catch {
                  setSaveMessage({
                    error: "השמירה לא הושלמה. בדקו את החיבור ונסו שוב.",
                    key,
                  });
                }
              });
            }}
          >
            {saving ? "שומר…" : "שמירת עותק לתיק"}
          </button>
        </div>
        <div className="mt-3 text-sm" aria-live="polite">
          {saveMessage.error && (
            <p className="text-red-700">{saveMessage.error}</p>
          )}
          {saveMessage.id && (
            <p className="text-teal-700">
              {saveMessage.key === fingerprint
                ? "התמהיל וההנחות נשמרו."
                : "הגרסה הקודמת נשמרה; השינויים הנוכחיים טרם נשמרו."}{" "}
              <Link
                className="underline"
                href={`/report/${saveMessage.id}`}
                target="_blank"
              >
                פתיחת דוח להדפסה
              </Link>
            </p>
          )}
        </div>
        <p className="mt-3 text-xs leading-6 text-slate-500">
          בחירת תיק קובעת היכן נשמר העותק; היא אינה מחליפה את נתוני משק הבית
          שהוזנו במסך. לטעינת נתוני תיק אחר פתחו את הסימולטור מתוך אותו תיק.
        </p>
        <button
          className={`${button} mt-4`}
          disabled={!sim || pinned.length >= 3}
          onClick={() =>
            sim &&
            setPinned((old) => [
              ...old,
              {
                label: label.trim() || `חלופה ${old.length + 1}`,
                simulation: sim,
              },
            ])
          }
        >
          <BookmarkPlus size={16} />
          הוספה להשוואה ({pinned.length}/3)
        </button>
        <p className="mt-2 text-xs text-slate-500">
          ההשוואה זמנית בדפדפן. שמרו לתיק כדי לשמור את התמהיל להמשך.
        </p>
        {pinned.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[540px] text-right text-sm">
              <thead>
                <tr>
                  <th className="py-3">מדד</th>
                  {pinned.map((p, i) => (
                    <th className="p-3" key={i}>
                      {p.label}
                      <div className="mt-2 flex gap-2">
                        <button
                          className={button}
                          aria-label={`טעינת ${p.label}`}
                          onClick={() => {
                            setInput(p.simulation.input);
                            setLabel(p.label);
                          }}
                        >
                          <RotateCcw size={14} />
                        </button>
                        <button
                          className={button}
                          aria-label={`הסרת ${p.label} מהשוואה`}
                          onClick={() =>
                            setPinned((old) => old.filter((_, n) => n !== i))
                          }
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["סכום", (s: SimulationResult) => money(s.input.amount)],
                    [
                      "תקופה",
                      (s: SimulationResult) => `${s.result.termMonths} חודשים`,
                    ],
                    ["מדד שנתי", (s: SimulationResult) => `${s.input.cpi}%`],
                    [
                      "החזר ראשון",
                      (s: SimulationResult) => money(s.result.firstPayment),
                    ],
                    [
                      "סך הוצאה",
                      (s: SimulationResult) => money(s.result.totalOutlay),
                    ],
                    [
                      "ריבית / הצמדה",
                      (s: SimulationResult) =>
                        `${money(s.result.totalInterest)} / ${money(s.result.totalIndexation)}`,
                    ],
                    [
                      "שיא החזר בלחץ",
                      (s: SimulationResult) =>
                        money(s.result.stressedPeakPayment),
                    ],
                    [
                      "בדיקות",
                      (s: SimulationResult) => <Status result={s.result} />,
                    ],
                  ] as [string, (s: SimulationResult) => ReactNode][]
                ).map(([name, get]) => (
                  <tr key={name} className="border-t border-slate-100">
                    <th className="py-3 font-normal text-slate-500">{name}</th>
                    {pinned.map((p, i) => (
                      <td className="p-3 tabular-nums" key={i}>
                        {get(p.simulation)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-amber-800">
              השוו גם את הסכום, התקופות, נתוני משק הבית והנחות הלחץ; כל חלופה
              שומרת את ההנחות שבהן חושבה.
            </p>
          </div>
        )}
      </Panel>
      <Assumptions />
    </div>
  );
}
function CashFlow({ sim }: { sim: SimulationResult }) {
  const [metric, setMetric] = useState<"payment" | "balance">("payment");
  const max = Math.max(
    1,
    ...sim.rows.map((r) => r[metric]),
    ...sim.stressRows.map((r) => r[metric]),
  );
  const path = (rows: SimulationResult["rows"]) =>
    rows
      .map(
        (r, i) =>
          `${i ? "L" : "M"}${50 + (i / Math.max(1, rows.length - 1)) * 890},${195 - (r[metric] / max) * 170}`,
      )
      .join(" ");
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button
          className={button}
          aria-pressed={metric === "payment"}
          onClick={() => setMetric("payment")}
        >
          תשלום חודשי
        </button>
        <button
          className={button}
          aria-pressed={metric === "balance"}
          onClick={() => setMetric("balance")}
        >
          יתרת קרן
        </button>
        <span className="text-xs text-teal-700">━━ בסיס</span>
        <span className="text-xs text-amber-700">┄┄ לחץ</span>
      </div>
      <svg
        viewBox="0 0 980 230"
        role="img"
        aria-label={`${metric === "payment" ? "תשלום חודשי" : "יתרת קרן"} בבסיס ובתרחיש לחץ, מחודש 1 עד ${sim.rows.length}. הנתונים זמינים בלוח ובבורר החודש.`}
        className="w-full overflow-visible"
        style={{ direction: "ltr" }}
      >
        <line x1="50" x2="940" y1="195" y2="195" stroke="#e2e8f0" />
        <line x1="50" x2="940" y1="25" y2="25" stroke="#f1f5f9" />
        <text x="50" y="15" fontSize="11" fill="#64748b">
          {money(max)}
        </text>
        <path d={path(sim.rows)} fill="none" stroke="#0f766e" strokeWidth="3" />
        <path
          d={path(sim.stressRows)}
          fill="none"
          stroke="#b45309"
          strokeWidth="2.5"
          strokeDasharray="7 5"
        />
        <text x="50" y="218" fontSize="12" fill="#64748b">
          1
        </text>
        <text x="940" y="218" textAnchor="end" fontSize="12" fill="#64748b">
          {sim.rows.length} חודשים
        </text>
      </svg>
    </>
  );
}
