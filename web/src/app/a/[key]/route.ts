import type { NextRequest } from "next/server";
import { getActionByKey } from "@/db/actions";
import { applyClimateAndBroadcast, fireIrButton } from "@/lib/mqtt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fire an action link. Public (gated by the unguessable key, not the session
 * cookie) and GET so a Bixby Quick Command / NFC tag / home-screen shortcut can
 * trigger it by simply opening the URL. Returns a tiny self-contained page so
 * the phone shows a clear confirmation.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const link = await getActionByKey(key);
  if (!link) {
    return page("Shortcut not found", "This link doesn’t exist or was removed.", false, 404);
  }

  try {
    if (link.action.kind === "climate") {
      await applyClimateAndBroadcast(link.deviceId, link.action.patch);
    } else {
      await fireIrButton(link.action.buttonId);
    }
  } catch {
    return page("Couldn’t send", "Helm didn’t accept the command. Try again.", false, 500);
  }

  return page(link.label, "Sent to Helm.", true, 200);
}

function page(title: string, sub: string, ok: boolean, status: number): Response {
  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const accent = ok ? "#b6f736" : "#ff5c5c";
  const glyph = ok ? "✓" : "✕";
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>${esc(title)} · Helm</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100dvh; display:grid; place-items:center; padding:24px;
    font: 500 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background:#0b0d0a; color:#e9efe6; -webkit-font-smoothing:antialiased; }
  .card { width:100%; max-width:360px; text-align:center;
    background:#12150f; border:1px solid #232a1c; border-radius:20px; padding:40px 28px; }
  .badge { width:72px; height:72px; margin:0 auto 20px; border-radius:50%;
    display:grid; place-items:center; font-size:38px; font-weight:700;
    color:${accent}; background:${accent}1a; border:1px solid ${accent}55; }
  h1 { margin:0 0 6px; font-size:22px; font-weight:800; letter-spacing:-0.02em; }
  p { margin:0; color:#8c9483; font-size:14px; }
  .brand { margin-top:22px; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:#5c6353; }
</style></head>
<body><div class="card">
  <div class="badge">${glyph}</div>
  <h1>${esc(title)}</h1>
  <p>${esc(sub)}</p>
  <div class="brand">Helm</div>
</div></body></html>`;
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
