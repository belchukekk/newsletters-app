import { NextResponse } from "next/server";
import { auth } from "@/lib/server/auth-admin";
import { logBlacklistEvent, setBlacklistCache } from "@/lib/domains/subscriptions";

// Port of AdminController::blacklistLogAction (/save-blacklist) — toggles
// the admin's own email (the NextAuth session's own email stands in for the
// old app's dual sessionEmail/sessionAdminEmail, which no longer exists).
export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const status = body?.type === "true";

  await logBlacklistEvent({ email, adminEmail: email, status });
  await setBlacklistCache(email, status ? "nl_admin" : null);

  return NextResponse.json({ success: true });
}
