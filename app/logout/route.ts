import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/server/session";

// Port of SessionManager::logout() for regular users. Admin logout is
// handled separately by NextAuth's own signOut() in the (admin) layout —
// the two sessions are independent, per PLAN.md's session model.
export async function GET(request: NextRequest) {
  await destroySession();
  return NextResponse.redirect(new URL("/", request.url));
}
