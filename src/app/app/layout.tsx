import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

const nav = [
  { href: "/app", label: "סקירה" },
  { href: "/app/contacts", label: "לקוחות ולידים" },
  { href: "/app/cases", label: "תיקי משכנתא" },
  { href: "/app/simulator", label: "סימולטור" },
  { href: "/app/tasks", label: "משימות" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-l border-slate-200 bg-white p-5 sm:block">
        <Link
          href="/app"
          className="text-xl font-bold tracking-tight text-slate-900"
        >
          Wise<span className="text-indigo-600">Card</span>
        </Link>
        <nav className="mt-8 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <span className="text-sm text-slate-500">
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
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              התנתקות
            </button>
          </form>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
