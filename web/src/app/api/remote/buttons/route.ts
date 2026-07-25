import { NextRequest, NextResponse } from "next/server";
import { createIrButton } from "@/db/ir";
import { publishHaDiscovery } from "@/lib/mqtt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Create a button. Body: { deviceId, label, icon?, protocol?, code, bits?, repeats? }. */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!deviceId) return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });
  if (!label) return NextResponse.json({ error: "Missing label" }, { status: 400 });
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  const button = await createIrButton({
    deviceId,
    label,
    code,
    icon: typeof body.icon === "string" ? body.icon : undefined,
    protocol: typeof body.protocol === "string" ? body.protocol : undefined,
    bits: typeof body.bits === "number" ? body.bits : undefined,
    repeats: typeof body.repeats === "number" ? body.repeats : undefined,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
  });
  await publishHaDiscovery();
  return NextResponse.json({ button });
}
