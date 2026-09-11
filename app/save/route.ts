import { NextRequest, NextResponse } from "next/server";
import { getPublishedNewsletters } from "@/lib/domains/newsletters";
import { handlePermission } from "@/lib/domains/subscriptions";
import { buildNewsletterUnsubscribeUrl, buildOptInConfirmUrl } from "@/lib/domains/optin";
import { sendOptInEmail } from "@/lib/integrations/mandrill";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Port of Controller::newsletterLogDataAction (/save) — public opt-in form
// POST (the /subscribe anonymous form posts here). Logs a "permission" BBL
// event, then sends the opt-in confirmation email via Mandrill (a named
// transactional template, not a fetched Mailchimp campaign — see
// lib/integrations/mandrill.ts). A send failure doesn't fail the request:
// the BBL event is the durable record of the subscribe attempt either way.
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const newsletterId = String(formData.get("newsletter_id") ?? "");

  if (!EMAIL_REGEX.test(email) || !newsletterId) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const newsletters = await getPublishedNewsletters();
  const newsletter = newsletters.find((n) => n.id === newsletterId);
  if (!newsletter) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const permissionResult = await handlePermission({
    email,
    authenticated: false,
    newsletterId,
    newsletterTitle: newsletter.title,
    subscribe: true,
  });

  if (permissionResult.ok && permissionResult.permissionId) {
    try {
      await sendOptInEmail({
        email,
        confirmUrl: buildOptInConfirmUrl(permissionResult.permissionId, email),
        unsubscribeUrl: buildNewsletterUnsubscribeUrl(email, newsletterId),
        newsletterTitle: newsletter.title,
        newsletterFrequency: newsletter.frequency,
      });
    } catch (error) {
      console.error("Failed to send opt-in email via Mandrill", error);
    }
  }

  return NextResponse.redirect(new URL("/", request.url));
}
