import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
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
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-l border-slate-200 bg-white p-5 sm:flex">
        <Link
          href="/app"
          className="text-xl font-bold tracking-tight text-slate-900"
        >
          Wise<span className="text-blue-600">Card</span>
        </Link>
        <div className="mt-8">
          <SideNav />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
          <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 sm:px-6">
            <Link
              href="/app"
              className="text-lg font-bold tracking-tight text-slate-900 sm:hidden"
            >
              Wise<span className="text-blue-600">Card</span>
            </Link>
            <span className="hidden truncate text-sm text-slate-500 sm:block">
              {session.user.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                התנתקות
              </button>
            </form>
          </div>
          <MobileNav />
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
