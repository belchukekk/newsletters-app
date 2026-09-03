import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/session";
import { handlePermission } from "@/lib/domains/subscriptions";

// Port of Controller::saveAjaxAction — AJAX subscribe/unsubscribe toggle for
// already-logged-in users, used by /manage and /subscribe's logged-in
// branch. Body shape is this app's own client/server contract (JSON, not
// legacy's jQuery form-post) since both sides are newly built here.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ result: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const clickedId = body?.clicked_id;
  const clickedTitle = body?.clicked_title;
  const type = body?.type;

  if (typeof clickedId !== "string" || typeof clickedTitle !== "string") {
    return NextResponse.json({ result: false }, { status: 400 });
  }

  const result = await handlePermission({
    email: session.email,
    authenticated: true,
    newsletterId: clickedId,
    newsletterTitle: clickedTitle,
    subscribe: type === "true",
  });

  return NextResponse.json({ result: result.ok });
}
