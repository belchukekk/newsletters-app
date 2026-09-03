import { NextResponse } from "next/server";
import { auth } from "@/lib/server/auth-admin";
import {
  invalidateNewsletterCache,
  reorderNewsletters,
} from "@/lib/domains/newsletters";

// Port of AdminController::reorderNewslettersAction — JSON body
// {"order": [ids]}, priority = position in that array (1-based).
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const order = body?.order;
  if (!Array.isArray(order) || !order.every((id) => typeof id === "string")) {
    return NextResponse.json(
      { success: false, error: "Invalid body" },
      { status: 400 }
    );
  }

  await reorderNewsletters(order);
  await invalidateNewsletterCache();

  return NextResponse.json({ success: true });
}
