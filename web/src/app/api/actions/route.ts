import { NextRequest, NextResponse } from "next/server";
import { createActionLink, listActionLinks } from "@/db/actions";
import { getIrDevice } from "@/db/ir";
import { parseIrAction } from "@/lib/ir-action-parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actions = await listActionLinks();
  return NextResponse.json({ actions });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const label = typeof body.label === "string" ? body.label.trim().slice(0, 60) : "";
  if (!label) return NextResponse.json({ error: "Missing label" }, { status: 400 });

  const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
  if (!deviceId || !(await getIrDevice(deviceId))) {
    return NextResponse.json({ error: "Unknown device" }, { status: 400 });
  }

  const action = await parseIrAction(body.action, deviceId);
  if (typeof action === "string") {
    return NextResponse.json({ error: action }, { status: 400 });
  }

  const link = await createActionLink({ label, deviceId, action });
  return NextResponse.json({ action: link });
}
