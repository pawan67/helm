import { NextRequest, NextResponse } from "next/server";
import { getSessionsPage } from "@/db/queries";
import { deleteSessions } from "@/db/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Keep only well-formed YYYY-MM-DD strings; anything else is ignored. */
function cleanDate(v: string | null): string | undefined {
  return v && DATE_RE.test(v) ? v : undefined;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const typeParam = sp.get("type");
  const type =
    typeParam === "pullup_set" || typeParam === "dead_hang"
      ? typeParam
      : undefined;

  const from = cleanDate(sp.get("from"));
  const to = cleanDate(sp.get("to"));

  // `pageSize` (with 1-based `page`) is the paginated path; `limit` is kept for
  // legacy callers that just want the N most recent.
  const pageSize = Math.min(
    100,
    Math.max(1, Number(sp.get("pageSize") ?? sp.get("limit") ?? 20)),
  );
  const page = Math.max(1, Math.floor(Number(sp.get("page") ?? 1)) || 1);
  const offset = (page - 1) * pageSize;

  const { rows, total } = await getSessionsPage({
    type,
    from,
    to,
    limit: pageSize,
    offset,
  });

  return NextResponse.json({ sessions: rows, total });
}

export async function DELETE(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ids =
    body && typeof body === "object" && Array.isArray((body as { ids?: unknown }).ids)
      ? ((body as { ids: unknown[] }).ids.filter(
          (x) => typeof x === "string",
        ) as string[])
      : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "No session ids given" }, { status: 400 });
  }

  const deleted = await deleteSessions(ids);
  return NextResponse.json({ ok: true, deleted });
}
