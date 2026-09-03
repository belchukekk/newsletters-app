import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/server/auth-magic-link";
import { createSession } from "@/lib/server/session";

// Port of Controller::newsletterUnsubscribeAction / AuthRequest::validateToken
// — the one-click unsubscribe link from campaign emails. Unrelated to both
// the regular-user magic link and admin SSO: just a signed token scheme, see
// PLAN.md. On failure the old app hard-stops with a plaintext message and no
// template — preserved as-is rather than inventing a nicer error page for a
// link that should never be malformed in practice.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const email = searchParams.get("email");
  const auth = searchParams.get("auth");
  const id = searchParams.get("id");

  if (!email || !auth || !verifyUnsubscribeToken(email, auth)) {
    return new NextResponse("token:invalid request", { status: 400 });
  }

  await createSession({ email });

  const destination = id ? `/unsubscribe?id=${encodeURIComponent(id)}` : "/unsubscribe";
  return NextResponse.redirect(new URL(destination, request.url));
}
