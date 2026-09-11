import { NextRequest, NextResponse } from "next/server";
import { decryptEmailToken } from "@/lib/server/email-token";
import { createSession } from "@/lib/server/session";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// A third, unrelated auth entry point alongside /auth (Drupal md5 magic
// link) and /newsletter-unsubscribe (AC-salt token) — used by an external
// system's OTP marketing links (AES-256-GCM encrypted token, see
// lib/server/email-token.ts). Decrypts the token to an email, creates the
// same regular-user session the other two entry points use, then shows the
// frontpage — which already renders subscription-aware content for a
// signed-in session (see app/(public)/page.tsx), so no separate
// subscription check is needed here.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  let email: string;
  try {
    email = decryptEmailToken(token, requireEnv("EMAIL_TOKEN_SECRET"));
  } catch {
    return NextResponse.redirect(new URL("/", request.url));
  }

  await createSession({ email });
  return NextResponse.redirect(new URL("/", request.url));
}
