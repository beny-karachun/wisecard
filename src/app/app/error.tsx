"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

export default function WorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="panel mx-auto max-w-xl py-12 text-center">
      <AlertCircle size={32} className="mx-auto text-amber-600" aria-hidden />
      <h1 className="mt-4 text-xl font-bold">לא הצלחנו לטעון את הנתונים</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        ייתכן שיש בעיית חיבור זמנית. אפשר לנסות שוב.
      </p>
      <button
        className="button-primary mt-6 disabled:opacity-60"
        disabled={pending}
        onClick={() =>
          startTransition(() => {
            router.refresh();
            reset();
          })
        }
      >
        {pending ? "טוען…" : "ניסיון נוסף"}
      </button>
    </div>
  );
}
