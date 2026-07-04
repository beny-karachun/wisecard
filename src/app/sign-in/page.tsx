import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function authenticate(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/app",
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect("/sign-in?error=1");
      }
      throw err; // re-throw redirect signals etc.
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-slate-900"
        >
          Wise<span className="text-blue-600">Card</span>
        </Link>
        <h1 className="mt-6 text-xl font-semibold text-slate-900">
          כניסה למערכת
        </h1>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            אימייל או סיסמה שגויים. בדוק את הפרטים ונסה שוב.
          </p>
        )}

        <form action={authenticate} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700"
            >
              אימייל
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              dir="ltr"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              סיסמה
            </label>
            <PasswordInput id="password" name="password" />
          </div>
          <SubmitButton className="w-full py-2.5">התחברות</SubmitButton>
        </form>
      </div>
    </main>
  );
}
