import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WiseCard — תוכנה לייעוץ משכנתאות",
  description:
    "מערכת ניהול לקוחות (CRM) וסימולטור משכנתאות מתקדם ליועצי משכנתאות בישראל.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" className="h-full">
      <body className={`${heebo.variable} min-h-full antialiased`}>
        {children}
      </body>
    </html>
  );
}
