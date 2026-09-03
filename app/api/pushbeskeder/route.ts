import { NextResponse } from "next/server";
import { logPushPermission, setPushSubscriptionCache } from "@/lib/domains/push";

// Port of Controller::pushPermissionsAction (POST) — updates a device's
// push preference in the cache and logs the corresponding BBL event.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const pushToken = body?.pushtoken;
  const list = body?.list;

  if (typeof pushToken !== "string" || typeof list !== "string") {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const subscribe = !!body?.state;
  const sys = !!body?.sys;

  await setPushSubscriptionCache(pushToken, list, subscribe);
  await logPushPermission({ pushToken, list, sys, subscribe });

  return NextResponse.json({ success: true });
}
