import Link from "next/link";
import { ArrowUpLeft, Building2, Plus } from "lucide-react";
import type { ReactNode, InputHTMLAttributes } from "react";

export function PageHeading({
  eyebrow = "סביבת העבודה שלך",
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-teal-700">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
export function Panel({
  title,
  children,
  href,
  className = "",
}: {
  title: string;
  children: ReactNode;
  href?: string;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="font-bold text-slate-900">{title}</h2>
        {href && (
          <Link
            className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-teal-700"
            href={href}
          >
            הצגת הכל <ArrowUpLeft size={15} aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
export function Empty({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-10 text-center">
      <Building2
        className="mx-auto mb-3 text-slate-400"
        size={28}
        aria-hidden
      />
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {description}
      </p>
      {href && (
        <Link
          className="mt-4 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-teal-700"
          href={href}
        >
          {label}
          <ArrowUpLeft size={16} aria-hidden />
        </Link>
      )}
    </div>
  );
}
export function AddSection({
  title,
  children,
  open = false,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details open={open} className="panel mb-6" id="new">
      <summary className="flex min-h-10 w-fit items-center gap-2 text-sm font-semibold text-teal-700">
        <Plus size={18} aria-hidden />
        {title}
      </summary>
      <div className="mt-5 border-t border-slate-100 pt-5">{children}</div>
    </details>
  );
}
export function Input({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="form-label">
      {label}
      <input {...props} className="form-input" />
    </label>
  );
}
export function Select({
  label,
  name,
  options,
  value,
  required = true,
}: {
  label: string;
  name: string;
  options: Record<string, string> | [string, string][];
  value?: string;
  required?: boolean;
}) {
  const entries = Array.isArray(options) ? options : Object.entries(options);
  return (
    <label className="form-label">
      {label}
      <select
        name={name}
        defaultValue={value}
        required={required}
        className="form-input"
      >
        {entries.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Notes({
  value,
  label = "הערות",
  name = "notes",
}: {
  value?: string | null;
  label?: string;
  name?: string;
}) {
  return (
    <label className="form-label col-span-full">
      {label}
      <textarea
        className="form-input min-h-24 resize-y"
        name={name}
        defaultValue={value ?? ""}
        maxLength={5000}
      />
    </label>
  );
}
export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "teal" | "amber" | "red";
}) {
  const colors = {
    slate: "bg-slate-100 text-slate-600",
    teal: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-800",
    red: "bg-red-50 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${colors[tone]}`}
    >
      {children}
    </span>
  );
}
