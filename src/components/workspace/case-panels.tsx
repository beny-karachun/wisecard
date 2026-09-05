import Link from "next/link";
import { ExternalLink, CheckCheck } from "lucide-react";
import type { CaseDocument, BankOffer } from "@prisma/client";
import {
  documentLabels,
  documentNeedsAttention,
  offerLabels,
  israelDate,
} from "@/lib/workspace";
import { formatCurrency, formatDate } from "@/lib/format";
import { Panel, Badge, Empty, AddSection } from "./ui";
import { ActionForm } from "./action-form";
import { DocumentForm } from "./forms";
import { BankOfferForm } from "./bank-offer-form";
import { initializeDocuments } from "@/app/app/workspace-actions";

export function DocumentsPanel({
  caseId,
  documents,
}: {
  caseId: string;
  documents: CaseDocument[];
}) {
  const ready = documents.filter((d) => !documentNeedsAttention(d)).length;
  return (
    <Panel title={`מסמכים והשלמות · ${ready}/${documents.length} טופלו`}>
      <p className="mb-4 text-xs leading-6 text-slate-500">
        מעקב פנימי עם קישורים לאחסון המשרד. הרשימה ניתנת להתאמה לדרישות הבנק
        ולתיק; מסמך שהתקבל עדיין ממתין לבדיקת היועץ.
      </p>
      <div className="mb-5">
        <ActionForm
          action={initializeDocuments}
          label="הוספת רשימת מסמכים לפי מטרת התיק"
          className="grid gap-2"
        >
          <input type="hidden" name="caseId" value={caseId} />
        </ActionForm>
      </div>
      <div className="space-y-3">
        {documents.map((doc) => (
          <details
            className="rounded-xl border border-slate-200 p-3"
            key={doc.id}
          >
            <summary className="flex min-h-10 items-center justify-between gap-3 text-sm">
              <span className="font-medium">{doc.title}</span>
              <Badge tone={documentNeedsAttention(doc) ? "amber" : "teal"}>
                {doc.expiresAt &&
                doc.expiresAt.toISOString().slice(0, 10) < israelDate() &&
                doc.status !== "NOT_REQUIRED"
                  ? "פג תוקף"
                  : documentLabels[doc.status]}
              </Badge>
            </summary>
            <div className="mt-4">
              {doc.url && (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm text-teal-700"
                >
                  פתיחת המסמך <ExternalLink size={14} aria-hidden />
                </a>
              )}
              <DocumentForm caseId={caseId} document={doc} />
            </div>
          </details>
        ))}
      </div>
      <div className="mt-5">
        <AddSection title="הוספת מסמך נוסף">
          <DocumentForm caseId={caseId} />
        </AddSection>
      </div>
    </Panel>
  );
}
export function BankOffersPanel({
  caseId,
  offers,
}: {
  caseId: string;
  offers: BankOffer[];
}) {
  const comparable =
    offers.length > 1 &&
    offers.every(
      (o) =>
        o.amount === offers[0].amount && o.termMonths === offers[0].termMonths,
    );
  return (
    <Panel title={`הצעות בנקים ואישורים · ${offers.length}`}>
      <p className="mb-4 text-xs leading-6 text-slate-500">
        הסכומים מוזנים מתוך הצעות הבנקים. החזר ראשון וסך תשלומים חזוי אינם
        מבטיחים את העלות בפועל. יש להשוות גם הצמדה, ריבית משתנה ותנאים.
      </p>
      {offers.length > 1 && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-xs leading-6 text-amber-900">
          {comparable
            ? "ההצעות באותו סכום ובאותה תקופה מרבית. עדיין יש לבחון את ההבדלים במסלולים ובהנחות התחזית."
            : "ההצעות שונות בסכום או בתקופה; השוואה ישירה של ההחזר והעלות אינה משקפת בהכרח חיסכון."}
        </p>
      )}
      {offers.length ? (
        <div className="mb-5 overflow-x-auto">
          <table className="w-full min-w-[650px] text-right text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                {[
                  "בנק",
                  "סכום",
                  "חודשים",
                  "החזר ראשון",
                  "סך חזוי",
                  "תוקף",
                  "סטטוס",
                ].map((t) => (
                  <th className="px-3 py-3 font-medium" key={t}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr className="border-b border-slate-100" key={o.id}>
                  <td className="px-3 py-4 font-semibold">
                    {o.bank}
                    {o.selected && (
                      <span className="mt-1 flex items-center gap-1 text-xs text-teal-700">
                        <CheckCheck size={14} aria-hidden />
                        נבחרה
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-4">{formatCurrency(o.amount)}</td>
                  <td className="px-3 py-4">{o.termMonths}</td>
                  <td className="px-3 py-4">
                    {formatCurrency(o.firstPayment)}
                  </td>
                  <td className="px-3 py-4">
                    {formatCurrency(o.totalPayment)}
                  </td>
                  <td className="px-3 py-4">
                    <span
                      className={
                        o.validUntil &&
                        o.validUntil.toISOString().slice(0, 10) < israelDate()
                          ? "text-red-700"
                          : ""
                      }
                    >
                      {formatDate(o.validUntil)}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <Badge tone={o.status === "APPROVED" ? "teal" : "slate"}>
                      {offerLabels[o.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="מתחילים סבב בנקים"
          description="תעדו הצעות ואישורים, הוסיפו מסלולים ובחרו את ההצעה להמשך טיפול."
        />
      )}
      <div className="space-y-3">
        {offers.map((o) => (
          <details
            key={o.id}
            className="rounded-xl border border-slate-200 p-3"
          >
            <summary className="min-h-10 py-2 text-sm font-semibold text-teal-700">
              פרטים ועריכת הצעה · {o.bank}
            </summary>
            <div className="mt-4">
              {o.url && (
                <a
                  className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm text-teal-700"
                  href={o.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  פתיחת האישור <ExternalLink size={14} aria-hidden />
                </a>
              )}
              <BankOfferForm caseId={caseId} offer={o} />
            </div>
          </details>
        ))}
      </div>
      <div className="mt-5">
        <AddSection title="הוספת הצעת בנק">
          <BankOfferForm caseId={caseId} />
        </AddSection>
      </div>
      <Link
        className="inline-flex min-h-10 items-center text-sm font-semibold text-teal-700"
        href={`/app/simulator?caseId=${caseId}`}
      >
        ניתוח תמהיל בסימולטור ←
      </Link>
    </Panel>
  );
}
