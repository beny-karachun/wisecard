"use client";
import { useState } from "react";
import type { BankOffer } from "@prisma/client";
import { Plus, X } from "lucide-react";
import { ActionForm } from "./action-form";
import { Input, Select, Notes } from "./ui";
import { saveBankOffer } from "@/app/app/workspace-actions";
import {
  offerLabels,
  trackLabels,
  offerTrackSchema,
  type OfferTrack,
} from "@/lib/workspace";

export function BankOfferForm({
  caseId,
  offer,
}: {
  caseId: string;
  offer?: BankOffer;
}) {
  const parsed = offerTrackSchema.array().safeParse(offer?.tracks ?? []);
  const [tracks, setTracks] = useState<(OfferTrack & { key: string })[]>(
    parsed.success ? parsed.data.map((t, i) => ({ ...t, key: String(i) })) : [],
  );
  function update(index: number, field: keyof OfferTrack, value: string) {
    setTracks((rows) =>
      rows.map((row, i) =>
        i === index
          ? { ...row, [field]: field === "type" ? value : Number(value) }
          : row,
      ),
    );
  }
  return (
    <ActionForm
      action={saveBankOffer}
      onSaved={() => {
        if (!offer) setTracks([]);
      }}
      label={offer ? "עדכון הצעת בנק" : "שמירת הצעת בנק"}
    >
      <input type="hidden" name="id" value={offer?.id ?? ""} />
      <input type="hidden" name="caseId" value={caseId} />
      <input
        type="hidden"
        name="tracks"
        value={JSON.stringify(
          tracks.map(({ type, amount, rate, termMonths }) => ({
            type,
            amount,
            rate,
            termMonths,
          })),
        )}
      />
      <Input
        label="בנק *"
        name="bank"
        required
        maxLength={100}
        defaultValue={offer?.bank}
      />
      <Select
        label="מצב הבקשה"
        name="status"
        options={offerLabels}
        value={offer?.status}
      />
      <Input
        label="איש קשר בבנק"
        name="banker"
        defaultValue={offer?.banker ?? ""}
      />
      <Input
        label="טלפון בבנק"
        name="phone"
        type="tel"
        dir="ltr"
        defaultValue={offer?.phone ?? ""}
      />
      <Input
        label="סכום ההצעה (₪) *"
        name="amount"
        type="number"
        min={1}
        required
        defaultValue={offer?.amount}
      />
      <Input
        label="תקופה מרבית (חודשים) *"
        name="termMonths"
        type="number"
        min={1}
        max={600}
        required
        defaultValue={offer?.termMonths ?? 360}
      />
      <Input
        label="החזר ראשון לפי הבנק (₪) *"
        name="firstPayment"
        type="number"
        min={1}
        required
        defaultValue={offer?.firstPayment}
      />
      <Input
        label="סך תשלומים חזוי לפי הבנק (₪)"
        name="totalPayment"
        type="number"
        min={1}
        defaultValue={offer?.totalPayment ?? ""}
      />
      <Input
        label="תוקף האישור עד"
        name="validUntil"
        type="date"
        defaultValue={
          offer?.validUntil
            ? new Date(offer.validUntil).toISOString().slice(0, 10)
            : ""
        }
      />
      <Input
        label="קישור להצעה / אישור (https)"
        name="url"
        type="url"
        dir="ltr"
        defaultValue={offer?.url ?? ""}
      />
      <fieldset className="col-span-full min-w-0">
        <legend className="mb-3 text-sm font-semibold">
          מסלולי ההצעה (אופציונלי)
        </legend>
        <div className="space-y-3">
          {tracks.map((t, i) => (
            <div
              className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2"
              key={t.key}
            >
              <label className="form-label">
                מסלול
                <select
                  className="form-input"
                  value={t.type}
                  onChange={(e) => update(i, "type", e.target.value)}
                >
                  {Object.entries(trackLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="סכום (₪)"
                type="number"
                min={1}
                required
                value={t.amount || ""}
                onChange={(e) => update(i, "amount", e.target.value)}
              />
              <Input
                label="ריבית שנתית (%)"
                type="number"
                min={0}
                max={30}
                step="0.001"
                required
                value={t.rate}
                onChange={(e) => update(i, "rate", e.target.value)}
              />
              <Input
                label="חודשים"
                type="number"
                min={1}
                max={600}
                required
                value={t.termMonths}
                onChange={(e) => update(i, "termMonths", e.target.value)}
              />
              <button
                type="button"
                className="flex min-h-10 w-fit items-center gap-1 text-xs text-red-600"
                onClick={() =>
                  setTracks((rows) => rows.filter((_, index) => index !== i))
                }
              >
                <X size={14} aria-hidden />
                הסרת מסלול
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={tracks.length >= 10}
          className="mt-3 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-teal-700 disabled:opacity-50"
          onClick={() =>
            setTracks((rows) => [
              ...rows,
              {
                key: crypto.randomUUID(),
                type: "FIXED_UNLINKED",
                amount: 0,
                rate: 0,
                termMonths: 360,
              },
            ])
          }
        >
          <Plus size={16} aria-hidden />
          הוספת מסלול
        </button>
      </fieldset>
      <label className="col-span-full flex min-h-10 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="selected"
          defaultChecked={offer?.selected}
        />
        הצעה נבחרת להמשך טיפול (מחליפה בחירה קודמת בתיק)
      </label>
      <Notes value={offer?.notes} />
    </ActionForm>
  );
}
