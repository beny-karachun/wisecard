"use client";

import {
  useActionState,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { SubmitButton } from "@/components/submit-button";

import type { ActionState } from "@/lib/workspace";
export function ActionForm({
  action,
  children,
  onSaved,
  label = "שמירת פרטים",
  className = "grid gap-4 sm:grid-cols-2",
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  onSaved?: () => void;
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const preserveValues = useRef(true);
  const [state, formAction] = useActionState(
    async (previous: ActionState, data: FormData) => {
      preserveValues.current = true;
      try {
        const result = await action(previous, data);
        // React resets forms after an action. Preserve entered values on errors and edits.
        if (result.success && !data.get("id") && !data.get("feeAgreed")) {
          preserveValues.current = false;
          formRef.current?.reset();
        }
        if (result.success) onSaved?.();
        return result;
      } catch {
        return {
          error: "השמירה לא הושלמה. הפרטים שהזנת נשמרו בטופס; אפשר לנסות שוב.",
        };
      }
    },
    {},
  );
  return (
    <form
      ref={formRef}
      action={formAction}
      onReset={(event) => {
        if (preserveValues.current) event.preventDefault();
      }}
      className={className}
    >
      {children}
      <div className="col-span-full flex flex-wrap items-center gap-3">
        <SubmitButton>{label}</SubmitButton>
        <p
          role={state.error ? "alert" : "status"}
          className={`text-sm ${state.error ? "text-red-700" : "text-emerald-700"}`}
        >
          {state.error || state.success}
        </p>
      </div>
    </form>
  );
}

// Submit an unambiguous UTC instant, respecting the advisor's browser time zone.
export function LocalDateTime({ value }: { value?: string }) {
  const zone = useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "UTC",
  );
  const parts = value
    ? new Intl.DateTimeFormat("sv-SE", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(value))
    : "";
  const local = parts.replace(" ", "T");
  return (
    <label className="form-label">
      מועד הפגישה ({zone})
      <input
        key={zone}
        type="datetime-local"
        required
        defaultValue={local}
        className="form-input"
        onChange={(e) => {
          const hidden =
            e.currentTarget.parentElement?.querySelector<HTMLInputElement>(
              'input[type="hidden"]',
            );
          if (hidden)
            hidden.value = e.currentTarget.value
              ? new Date(e.currentTarget.value).toISOString()
              : "";
        }}
      />
      <input type="hidden" name="startsAt" defaultValue={value || ""} />
    </label>
  );
}
