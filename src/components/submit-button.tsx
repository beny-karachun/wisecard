"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

const variants = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 disabled:hover:bg-blue-600",
  subtle:
    "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:hover:bg-blue-50",
  outline:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:hover:bg-white",
  success:
    "bg-green-600 text-white hover:bg-green-700 disabled:hover:bg-green-600",
  danger: "text-red-600 hover:bg-red-50 disabled:hover:bg-transparent",
} as const;

/**
 * Submit button for server-action forms: shows a spinner while the parent
 * form is pending, and optionally asks for confirmation (destructive actions).
 */
export function SubmitButton({
  children,
  variant = "primary",
  confirmMessage,
  className = "",
  formAction,
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  confirmMessage?: string;
  className?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending}
      onClick={
        confirmMessage
          ? (e) => {
              if (!window.confirm(confirmMessage)) e.preventDefault();
            }
          : undefined
      }
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:opacity-60 ${variants[variant]} ${className}`}
    >
      {pending && (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
