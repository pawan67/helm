import { NextRequest, NextResponse } from "next/server";
import { updateIrButton, deleteIrButton, type IrButtonPatch } from "@/db/ir";
import { publishHaDiscovery, clearHaDiscovery } from "@/lib/mqtt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: IrButtonPatch = {};
  if (typeof body.label === "string" && body.label.trim()) patch.label = body.label.trim();
  if (typeof body.icon === "string") patch.icon = body.icon;
  if (typeof body.protocol === "string") patch.protocol = body.protocol;
  if (typeof body.code === "string" && body.code.trim()) patch.code = body.code.trim();
  if (typeof body.bits === "number") patch.bits = body.bits;
  if (typeof body.repeats === "number") patch.repeats = body.repeats;
  if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder;

  const button = await updateIrButton(id, patch);
  if (!button) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await publishHaDiscovery();
  return NextResponse.json({ button });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ok = await deleteIrButton(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  clearHaDiscovery([{ kind: "button", id }]);
  await publishHaDiscovery();
  return NextResponse.json({ ok: true });
}
