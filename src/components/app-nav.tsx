"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calculator,
  FolderKanban,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Users,
} from "lucide-react";

const items = [
  { href: "/app", label: "סקירה", icon: LayoutDashboard, exact: true },
  { href: "/app/contacts", label: "לקוחות ולידים", icon: Users },
  { href: "/app/cases", label: "תיקי משכנתא", icon: FolderKanban },
  { href: "/app/simulator", label: "סימולטור", icon: Calculator },
  { href: "/app/data", label: "מרכז נתונים", icon: LineChart },
  { href: "/app/tasks", label: "משימות", icon: ListChecks },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

/** Desktop sidebar navigation with active-state indicator. */
export function SideNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-1" aria-label="ניווט ראשי">
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(pathname, href, exact);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile: horizontal scrollable tab bar shown under the header. */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-1.5 sm:hidden"
      aria-label="ניווט ראשי"
    >
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(pathname, href, exact);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
