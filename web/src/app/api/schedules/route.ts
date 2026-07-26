import { NextRequest, NextResponse } from "next/server";
import { createSchedule, listSchedules, type ScheduleInput } from "@/db/schedules";
import { parseScheduleBody } from "./parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const schedules = await listSchedules();
  return NextResponse.json({ schedules });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = await parseScheduleBody(body, { partial: false });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // parse(partial:false) guarantees the required fields are present.
  const schedule = await createSchedule(parsed.value as ScheduleInput);
  return NextResponse.json({ schedule });
}
