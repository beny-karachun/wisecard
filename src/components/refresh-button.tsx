"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { refreshMarketData } from "@/app/app/actions";

export function RefreshButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => refreshMarketData())}
      disabled={pending}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
    >
      <RefreshCw
        className={`h-4 w-4 ${pending ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      {pending ? "מעדכן..." : "עדכן נתונים"}
    </button>
  );
}
