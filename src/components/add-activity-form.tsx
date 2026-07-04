"use client";

import { useRef } from "react";
import { activityChannelLabel } from "@/lib/labels";
import { createActivity } from "@/app/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { inputClass } from "@/components/field";

export function AddActivityForm({
  contactId,
  caseId,
}: {
  contactId?: string;
  caseId?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      action={async (fd) => {
        await createActivity(fd);
        ref.current?.reset();
      }}
      className="space-y-2"
    >
      {contactId ? (
        <input type="hidden" name="contactId" value={contactId} />
      ) : null}
      {caseId ? <input type="hidden" name="caseId" value={caseId} /> : null}

      <label>
        <span className="sr-only">סוג הפעילות</span>
        <select
          name="channel"
          defaultValue="NOTE"
          className={`${inputClass} w-auto`}
        >
          {Object.entries(activityChannelLabel).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="sr-only">תוכן הפעילות</span>
        <textarea
          name="body"
          required
          rows={2}
          placeholder="הערה, סיכום שיחה, עדכון..."
          className={inputClass}
        />
      </label>

      <SubmitButton>הוסף פעילות</SubmitButton>
    </form>
  );
}
