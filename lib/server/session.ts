import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// Replaces the old app's $_SESSION for regular users (not admins — those get
// NextAuth's own session, see auth-admin.ts). Signed, httpOnly, Secure,
// SameSite=Lax JWT cookie per PLAN.md's session model. The old PHP session
// had no explicit lifetime (a native, non-persistent session cookie, cleared
// on browser close) and the magic link itself never expires — a stateless
// JWT needs *some* expiration, so this picks a generous 30-day ceiling rather
// than trying to replicate "until browser close", which doesn't carry over.
const COOKIE_NAME = "nl_session";
const SESSION_TTL = "30d";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type SessionPayload = {
  email: string;
  // Port of SessionManager's origin_link/origin_label — an optional "back to
  // X" link, set from /auth's return_link/return_label query params.
  originLink?: string;
  originLabel?: string;
};

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing required env var: SESSION_SECRET");
  return new TextEncoder().encode(secret);
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(getSecretKey());

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.email !== "string") return null;
    return {
      email: payload.email,
      originLink: typeof payload.originLink === "string" ? payload.originLink : undefined,
      originLabel:
        typeof payload.originLabel === "string" ? payload.originLabel : undefined,
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
