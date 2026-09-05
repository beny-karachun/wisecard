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
  CalendarDays,
  Files,
  Landmark,
  Wallet,
} from "lucide-react";

const items = [
  {
    href: "/app",
    label: "לוח בקרה",
    icon: LayoutDashboard,
    exact: true,
    group: "ניהול המשרד",
  },
  { href: "/app/contacts", label: "לקוחות ולידים", icon: Users },
  { href: "/app/cases", label: "תיקי משכנתא", icon: FolderKanban },
  { href: "/app/calendar", label: "יומן פגישות", icon: CalendarDays },
  { href: "/app/tasks", label: "משימות ומעקב", icon: ListChecks },
  {
    href: "/app/documents",
    label: "מסמכים והשלמות",
    icon: Files,
    group: "עבודה על התיק",
  },
  { href: "/app/banks", label: "בנקים ואישורים", icon: Landmark },
  { href: "/app/simulator", label: "סימולטור משכנתא", icon: Calculator },
  { href: "/app/data", label: "נתוני שוק", icon: LineChart },
  { href: "/app/fees", label: "שכר טרחה וגבייה", icon: Wallet },
];
function activePath(path: string, href: string, exact?: boolean) {
  return exact ? path === href : path === href || path.startsWith(`${href}/`);
}
export function SideNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-1" aria-label="ניווט ראשי">
      {items.map(({ href, label, icon: Icon, exact, group }) => (
        <div key={href}>
          {group && (
            <p className="px-3 pb-3 pt-6 text-[11px] font-medium text-slate-400">
              {group}
            </p>
          )}
          <Link
            href={href}
            aria-current={
              activePath(pathname, href, exact) ? "page" : undefined
            }
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${activePath(pathname, href, exact) ? "bg-teal-50 font-semibold text-teal-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
          >
            <Icon size={18} className="shrink-0" aria-hidden />
            {label}
          </Link>
        </div>
      ))}
    </nav>
  );
}
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden"
      aria-label="ניווט ראשי"
    >
      {items.map(({ href, label, icon: Icon, exact }) => (
        <Link
          key={href}
          href={href}
          aria-current={activePath(pathname, href, exact) ? "page" : undefined}
          className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${activePath(pathname, href, exact) ? "bg-teal-50 text-teal-800" : "text-slate-500"}`}
        >
          <Icon size={15} aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}
