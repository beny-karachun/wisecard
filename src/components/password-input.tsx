"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { inputClass } from "@/components/field";

export function PasswordInput({
  id,
  name,
  autoComplete = "current-password",
}: {
  id: string;
  name: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative mt-1">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        required
        autoComplete={autoComplete}
        dir="ltr"
        className={`${inputClass} pe-10`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "הסתר סיסמה" : "הצג סיסמה"}
        className="absolute end-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 transition hover:text-slate-600"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
