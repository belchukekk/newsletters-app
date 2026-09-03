import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLinkCheck } from "@/lib/server/auth-magic-link";
import { createSession } from "@/lib/server/session";

// Port of Controller::authAction — regular-user magic-link entry only. The
// admin `check=md5(admin+time+email+key)` variant is retired entirely:
// admins use Google SSO now (see auth-admin.ts). No expiry check on `time`,
// matching the old app exactly — the KD Drupal site's existing links must
// keep working unchanged.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const email = searchParams.get("email");
  const time = searchParams.get("time");
  const check = searchParams.get("check");
  const id = searchParams.get("id");
  const returnLink = searchParams.get("return_link");
  const returnLabel = searchParams.get("return_label") ?? "Tilbage";

  if (!email || !time || !check || !verifyMagicLinkCheck(email, time, check)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  await createSession({
    email,
    originLink: returnLink ?? undefined,
    originLabel: returnLink ? returnLabel : undefined,
  });

  const destination = id ? `/subscribe?id=${encodeURIComponent(id)}` : "/manage";
  return NextResponse.redirect(new URL(destination, request.url));
}
