import { NextRequest, NextResponse } from "next/server";
import { getEnvSeries } from "@/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Aggregated ambient temperature/humidity history for the Environment view.
 * `?days=7` (hourly buckets) or `?days=30` (daily buckets); anything else
 * normalizes to 7.
 */
export async function GET(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get("days") ?? 7);
  const series = await getEnvSeries(days);
  return NextResponse.json(series);
}
