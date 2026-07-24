import { NextRequest, NextResponse } from "next/server";
import { getRecentSessions } from "@/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limit = Math.min(
    100,
    Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 20)),
  );
  const rows = await getRecentSessions(limit);
  return NextResponse.json({ sessions: rows });
}
