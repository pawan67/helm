import { NextRequest, NextResponse } from "next/server";
import { getSessionWithReps } from "@/db/queries";
import { updateSession, deleteSession, type SessionInput } from "@/db/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

function clampInt(v: unknown, min: number, max: number): number | null {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const found = await getSessionWithReps(id);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(found);
}

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

  const patch: Partial<SessionInput> = {};

  if ("startedAt" in body) {
    const d = new Date(String(body.startedAt));
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid startedAt" }, { status: 400 });
    }
    patch.startedAt = d.toISOString();
  }
  if ("durationMs" in body) {
    const v = clampInt(body.durationMs, 0, DAY_MS);
    if (v !== null) patch.durationMs = v;
  }
  if ("reps" in body) {
    const v = clampInt(body.reps, 0, 10_000);
    if (v !== null) patch.reps = v;
  }
  if ("hangMs" in body) {
    const v = clampInt(body.hangMs, 0, DAY_MS);
    if (v !== null) patch.hangMs = v;
  }
  if ("maxHangMs" in body) {
    const v = clampInt(body.maxHangMs, 0, DAY_MS);
    if (v !== null) patch.maxHangMs = v;
  }

  const session = await updateSession(id, patch);
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ session });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ok = await deleteSession(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
