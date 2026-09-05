import Link from "next/link";
export default function NotFound() {
  return (
    <div className="panel mx-auto max-w-xl py-12 text-center">
      <h1 className="text-xl font-bold">הרשומה לא נמצאה</h1>
      <p className="mt-3 text-sm text-slate-500">
        ייתכן שהרשומה נמחקה או שאינה זמינה במשרד שלך.
      </p>
      <Link className="button-primary mt-6" href="/app">
        חזרה ללוח הבקרה
      </Link>
    </div>
  );
}
