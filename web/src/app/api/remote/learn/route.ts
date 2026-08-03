import { NextRequest, NextResponse } from "next/server";
import { startIrLearn } from "@/lib/mqtt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Toggle IR learn mode on the bar node. Body: { on: boolean }. The device
 * enables its receiver and streams any decoded frame back over the live bus
 * (kind: "ir_learned"), which the open button dialog uses to auto-fill a code.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const on = body.on === true;
  const ok = startIrLearn(on);
  if (!ok) {
    return NextResponse.json({ error: "Device offline" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
