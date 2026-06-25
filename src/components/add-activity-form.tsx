"use client";

import { useRef } from "react";
import { activityChannelLabel } from "@/lib/labels";
import { createActivity } from "@/app/app/actions";

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

      <select
        name="channel"
        defaultValue="NOTE"
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
      >
        {Object.entries(activityChannelLabel).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>

      <textarea
        name="body"
        required
        rows={2}
        placeholder="הערה, סיכום שיחה, עדכון..."
        className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
      />

      <button
        type="submit"
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        הוסף פעילות
      </button>
    </form>
  );
}
