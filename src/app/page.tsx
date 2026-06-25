import Link from "next/link";

const features = [
  {
    title: "ניהול לקוחות (CRM)",
    desc: "לידים, לקוחות, צנרת מכירות, משימות ותזכורות — הכול בכרטיס לקוח אחד.",
  },
  {
    title: "סימולטור משכנתאות",
    desc: "חישוב מסלולים, לוח שפיצר, השוואת תמהילים ואופטימיזציה חכמה.",
  },
  {
    title: "מרכז נתונים פיננסי",
    desc: "ריביות, מדדים ועוגנים מתעדכנים אוטומטית מנתוני בנק ישראל והלמ״ס.",
  },
  {
    title: "מסמכים ובינה מלאכותית",
    desc: "קריאת דפי יתרות ואישורים עקרוניים, שאלון חכם ויצירת דוחות ממותגים.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-16">
      <header className="flex items-center justify-between">
        <span className="text-2xl font-bold tracking-tight text-slate-900">
          Wise<span className="text-indigo-600">Card</span>
        </span>
        <Link
          href="/sign-in"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          כניסה למערכת
        </Link>
      </header>

      <section className="mt-24 max-w-2xl">
        <p className="mb-3 text-sm font-semibold text-indigo-600">
          תוכנה ליועצי משכנתאות
        </p>
        <h1 className="text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
          כל הכלים שיועץ המשכנתאות צריך — במקום אחד.
        </h1>
        <p className="mt-5 text-lg text-slate-600">
          CRM, סימולטור משכנתאות מתקדם, ניהול מסמכים ובינה מלאכותית. בנוי על נתונים
          פתוחים של בנק ישראל והלמ״ס.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/sign-in"
            className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            התחברות
          </Link>
        </div>
      </section>

      <section className="mt-24 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-slate-900">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {f.desc}
            </p>
          </div>
        ))}
      </section>

      <footer className="mt-auto pt-24 text-sm text-slate-400">
        WiseCard · Phase 0 skeleton · בנוי עם Next.js
      </footer>
    </main>
  );
}
