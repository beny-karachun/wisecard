import { Check } from "lucide-react";
import { toggleTask } from "@/app/app/actions";

/** Checkbox-style toggle for a task; 24px visual, ~40px hit area. */
export function TaskToggle({ id, done }: { id: string; done: boolean }) {
  return (
    <form action={toggleTask.bind(null, id)} className="shrink-0">
      <button
        type="submit"
        aria-label={done ? "סמן כלא בוצע" : "סמן כבוצע"}
        aria-pressed={done}
        className="-m-2 p-2"
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-md border transition ${
            done
              ? "border-green-600 bg-green-600 text-white"
              : "border-slate-300 bg-white hover:border-blue-400"
          }`}
        >
          {done && <Check className="h-4 w-4" aria-hidden="true" />}
        </span>
      </button>
    </form>
  );
}
