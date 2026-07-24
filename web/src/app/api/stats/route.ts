import { NextRequest, NextResponse } from "next/server";
import { getDailyStats } from "@/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const days = Math.min(
    365,
    Math.max(7, Number(req.nextUrl.searchParams.get("days") ?? 30)),
  );
  const rows = await getDailyStats(days);
  return NextResponse.json({ days: rows });
}
