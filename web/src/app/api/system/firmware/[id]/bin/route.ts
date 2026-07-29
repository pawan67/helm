import { NextRequest } from "next/server";
import { getFirmwareData } from "@/db/firmware";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Raw firmware download for the bar node during an OTA push. The device has no
 * session cookie, so this is gated by the shared device key (`?k=`) instead of
 * the login. The image isn't secret; the key just stops casual pulls.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const key = req.nextUrl.searchParams.get("k");
  if (env.deviceKey && key !== env.deviceKey) {
    return new Response("Forbidden", { status: 403 });
  }

  const { id } = await params;
  const fw = await getFirmwareData(id);
  if (!fw) return new Response("Not found", { status: 404 });

  // Copy into a fresh ArrayBuffer-backed view so it satisfies BodyInit.
  const body = new Uint8Array(fw.data);
  return new Response(body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(fw.size),
      "Content-Disposition": `attachment; filename="${fw.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
