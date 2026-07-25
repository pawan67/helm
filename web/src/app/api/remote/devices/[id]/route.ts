import { NextRequest, NextResponse } from "next/server";
import { getIrDevices, updateIrDevice, deleteIrDevice, type IrDevicePatch } from "@/db/ir";
import { publishHaDiscovery, clearHaDiscovery } from "@/lib/mqtt";
import { DEFAULT_PANASONIC_CONFIG, type IrClimateConfig } from "@/lib/ir-climate";

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

  const patch: IrDevicePatch = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.icon === "string") patch.icon = body.icon;
  if (typeof body.protocol === "string") patch.protocol = body.protocol;
  if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder;
  // Climate config (partial merge over the current/default config).
  if (body.config && typeof body.config === "object") {
    const c = body.config as Partial<IrClimateConfig>;
    patch.config = { ...DEFAULT_PANASONIC_CONFIG, ...c };
  }

  const device = await updateIrDevice(id, patch);
  if (!device) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await publishHaDiscovery();
  return NextResponse.json({ device });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Collect retained HA discovery topics to clear before the cascade delete.
  const device = (await getIrDevices()).find((d) => d.id === id);
  const ok = await deleteIrDevice(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (device) {
    if (device.kind === "climate") clearHaDiscovery([{ kind: "climate", id }]);
    else clearHaDiscovery(device.buttons.map((b) => ({ kind: "button" as const, id: b.id })));
  }
  await publishHaDiscovery();
  return NextResponse.json({ ok: true });
}
