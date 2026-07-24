import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

/**
 * Edge-safe session token helpers. Deliberately free of `next/headers` so this
 * module can be imported from middleware (Edge runtime) as well as from server
 * components / route handlers.
 */

export const COOKIE_NAME = "pt_session";
export const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): Uint8Array {
  return new TextEncoder().encode(env.sessionSecret);
}

export async function signSessionToken(): Promise<string> {
  return new SignJWT({ sub: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}
