import { NextResponse } from "next/server";
import { auth } from "@/lib/server/auth-admin";
import { handlePermission } from "@/lib/domains/subscriptions";

// Lets an admin toggle an arbitrary user's newsletter subscription on their
// behalf (customer support: look someone up by email, fix their state). Not
// a port of anything in the old app — the legacy admin dashboard only ever
// showed the admin's own subscription state, never another user's. Reuses
// the same handlePermission() cache+BBL update /saveajax uses, just with an
// explicit target email instead of the caller's own session email, and the
// admin's email attached to the BBL event for accountability.
export async function POST(request: Request) {
  const session = await auth();
  const adminEmail = session?.user?.email;
  if (!adminEmail) {
    return NextResponse.json({ result: false }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const targetEmail = body?.email;
  const newsletterId = body?.newsletterId;
  const newsletterTitle = body?.newsletterTitle;
  const subscribe = !!body?.subscribe;

  if (
    typeof targetEmail !== "string" ||
    !targetEmail ||
    typeof newsletterId !== "string" ||
    typeof newsletterTitle !== "string"
  ) {
    return NextResponse.json({ result: false }, { status: 400 });
  }

  const result = await handlePermission({
    email: targetEmail,
    authenticated: true,
    adminEmail,
    newsletterId,
    newsletterTitle,
    subscribe,
  });

  return NextResponse.json({ result: result.ok });
}
