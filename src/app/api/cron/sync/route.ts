import { NextResponse } from "next/server";
import { syncMarketData } from "@/lib/market/sync";

export const dynamic = "force-dynamic";

// Scheduled market-data sync. Point a daily cron (Vercel Cron or external) at
// this URL. Protected by CRON_SECRET when set (Bearer header or ?token=).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const token = new URL(req.url).searchParams.get("token");
    if (auth !== `Bearer ${secret}` && token !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const result = await syncMarketData();
  return NextResponse.json({ ok: true, ...result });
}
