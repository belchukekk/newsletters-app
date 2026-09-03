import { NextResponse } from "next/server";
import { invalidateNewsletterCache } from "@/lib/domains/newsletters";

// Port of Controller::clearNewsletterDataCache — no auth guard in the old
// routing either. The old app only cleared `newsletter_data`, silently
// leaving `newsletter_data_admin` stale (see docs/LEGACY_APP_INVENTORY.md's
// known issues #3); invalidateNewsletterCache() already clears both.
export async function GET() {
  await invalidateNewsletterCache();
  return NextResponse.json({ success: true });
}
