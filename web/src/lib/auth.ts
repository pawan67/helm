import { cookies } from "next/headers";
import { env } from "./env";
import {
  COOKIE_NAME,
  MAX_AGE_SECONDS,
  signSessionToken,
  verifyToken,
} from "./session";

/**
 * Server-component / route-handler auth helpers (use next/headers cookies()).
 * Edge middleware must import verifyToken from ./session instead.
 */

/** Constant-time password comparison. */
export function passwordMatches(input: string): boolean {
  const expected = env.appPassword;
  if (!expected) return false;
  if (input.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < input.length; i++) {
    diff |= input.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function createSession(): Promise<void> {
  const token = await signSessionToken();
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Whether the current request carries a valid session cookie. */
export async function isAuthed(): Promise<boolean> {
  const store = await cookies();
  return verifyToken(store.get(COOKIE_NAME)?.value);
}

export { COOKIE_NAME };
