"use client";

import { useTransition } from "react";
import { refreshMarketData } from "@/app/app/actions";

export function RefreshButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => refreshMarketData())}
      disabled={pending}
      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
    >
      {pending ? "מעדכן..." : "עדכן נתונים"}
    </button>
  );
}
