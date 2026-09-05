import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, PanelsTopLeft, Search, ShieldCheck } from "lucide-react";
import { auth, signOut } from "@/auth";
import { MobileNav, SideNav } from "@/components/app-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:right-2 focus:z-50 focus:bg-white focus:p-3"
      >
        דילוג לתוכן
      </a>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-l border-slate-200/70 bg-white px-4 py-7 lg:flex">
        <Link href="/app" className="flex items-center gap-2.5 px-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-teal-800 text-white">
            <PanelsTopLeft size={20} aria-hidden />
          </span>
          <span
            dir="ltr"
            className="text-xl font-bold tracking-tight text-slate-900"
          >
            Wise<span className="text-teal-700">Card</span>
          </span>
        </Link>
        <p className="mt-2 px-3 text-[11px] text-slate-400">
          סביבת העבודה ליועצי משכנתאות
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SideNav />
        </div>
        <div className="mt-5 rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck
              size={16}
              className="shrink-0 text-teal-700"
              aria-hidden
            />
            <span className="truncate text-xs font-semibold text-slate-700">
              {session.user.name || "סביבת המשרד"}
            </span>
          </div>
          <p
            dir="ltr"
            className="mt-2 truncate text-right text-[11px] text-slate-400"
          >
            {session.user.email}
          </p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/95 backdrop-blur-sm">
          <div className="flex min-h-18 items-center justify-between gap-3 px-4 py-3 sm:px-7">
            <Link
              href="/app"
              className="text-lg font-bold text-teal-800 lg:hidden"
              dir="ltr"
            >
              WiseCard
            </Link>
            <form
              action="/app/contacts"
              className="relative hidden w-full max-w-sm sm:block"
            >
              <Search
                className="pointer-events-none absolute right-3 top-3 text-slate-400"
                size={16}
                aria-hidden
              />
              <input
                aria-label="חיפוש לקוח לפי שם, טלפון או אימייל"
                name="q"
                placeholder="חיפוש לקוח, טלפון או אימייל…"
                className="min-h-10 w-full rounded-xl bg-slate-50 pr-10 pl-3 text-xs outline-none focus:ring-2 focus:ring-teal-200"
              />
            </form>
            <form
              className="mr-auto"
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs text-slate-500 transition-colors hover:bg-slate-100"
              >
                <LogOut size={15} aria-hidden />
                <span>התנתקות</span>
              </button>
            </form>
          </div>
          <MobileNav />
        </header>
        <main id="main-content" className="min-w-0 flex-1 p-4 sm:p-7 xl:p-9">
          {children}
        </main>
      </div>
    </div>
  );
}
