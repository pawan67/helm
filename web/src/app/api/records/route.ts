import { NextResponse } from "next/server";
import { getRecords } from "@/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const records = await getRecords();
  return NextResponse.json({ records });
}
