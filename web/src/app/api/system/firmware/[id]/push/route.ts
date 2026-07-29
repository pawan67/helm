import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getFirmwareMeta } from "@/db/firmware";
import { publishOtaCommand } from "@/lib/mqtt";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The origin the device should use to reach this app. Prefer the OTA_BASE_URL
 * override; otherwise reconstruct the origin the operator's browser used (honors
 * a reverse proxy's forwarded headers), which the bar node can usually reach too.
 */
function downloadBase(req: NextRequest): string {
  if (env.otaBaseUrl) return env.otaBaseUrl.replace(/\/$/, "");
  const proto =
    req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(/:$/, "");
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  return `${proto}://${host}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const meta = await getFirmwareMeta(id);
  if (!meta) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const base = downloadBase(req);
  const key = env.deviceKey;
  const url = `${base}/api/system/firmware/${id}/bin${
    key ? `?k=${encodeURIComponent(key)}` : ""
  }`;

  const ok = publishOtaCommand({
    url,
    version: meta.version,
    md5: meta.md5,
    size: meta.size,
  });
  if (!ok) {
    return NextResponse.json(
      { error: "Broker not connected — can't reach the device" },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, url });
}
