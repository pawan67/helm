import { NextRequest, NextResponse } from "next/server";
import { fireIrButton } from "@/lib/mqtt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fire a generic IR button. Body: { buttonId }. */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const buttonId = typeof body.buttonId === "string" ? body.buttonId : "";
  if (!buttonId) return NextResponse.json({ error: "Missing buttonId" }, { status: 400 });

  const ok = await fireIrButton(buttonId);
  if (!ok) {
    return NextResponse.json({ error: "Unknown button or device offline" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
