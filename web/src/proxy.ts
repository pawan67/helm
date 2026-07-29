import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME } from "@/lib/session";

/**
 * Gate every page and API route behind the session cookie, except the login
 * page, the auth endpoints, and static assets. Unauthenticated page requests
 * redirect to /login; unauthenticated API requests get a 401.
 *
 * Next 16 renamed the `middleware` convention to `proxy` (runs on the Node.js
 * runtime — jose works here). See node_modules/next/dist/docs upgrade guide.
 */
// `/a/<key>` action links are gated by their unguessable key, not the cookie —
// so a Bixby Quick Command / NFC tag / widget can fire them without logging in.
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/a"];

// The firmware image download is device-facing: the bar node has no session
// cookie, so it's gated by the device key (`?k=`) inside the route itself, like
// an action link. Only the `.../bin` leaf is public — upload/list/delete/push
// stay behind the cookie.
const FIRMWARE_BIN_PATH = /^\/api\/system\/firmware\/[^/]+\/bin$/;

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  if (FIRMWARE_BIN_PATH.test(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const authed = await verifyToken(token);
  if (authed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on everything except Next internals and common static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
