import { NextRequest, NextResponse } from "next/server";
import { createIrDevice } from "@/db/ir";
import { publishHaDiscovery } from "@/lib/mqtt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Create an IR device. Body: { name, kind: "climate"|"generic", icon?, protocol? }. */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const kind = body.kind === "climate" || body.kind === "generic" ? body.kind : null;
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
  if (!kind) return NextResponse.json({ error: "Invalid kind" }, { status: 400 });

  const device = await createIrDevice({
    name,
    kind,
    icon: typeof body.icon === "string" ? body.icon : undefined,
    protocol: typeof body.protocol === "string" ? body.protocol : undefined,
  });
  await publishHaDiscovery();
  return NextResponse.json({ device });
}
