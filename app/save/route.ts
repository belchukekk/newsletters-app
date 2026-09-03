import { NextRequest, NextResponse } from "next/server";
import { getPublishedNewsletters } from "@/lib/domains/newsletters";
import { handlePermission, markOptInSent } from "@/lib/domains/subscriptions";
import { getOptInEmailHtml } from "@/lib/integrations/mailchimp";
import { sendOptInEmail } from "@/lib/integrations/notifier";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Port of Controller::newsletterLogDataAction (/save) — public opt-in form
// POST (the /subscribe anonymous form posts here). Logs a "permission" BBL
// event, fetches the opt-in template from Mailchimp, sends it via Notifier,
// then marks the same event optin_sent on success. No BBL log on Notifier
// failure — matches the old app exactly.
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

  if (!permissionResult.ok || !permissionResult.permissionId) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  let html: string;
  try {
    html = await getOptInEmailHtml({
      mail: email,
      permissionId: permissionResult.permissionId,
      newsletterTitle: newsletter.title,
      newsletterFrequency: newsletter.frequency,
    });
  } catch {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const sent = await sendOptInEmail({
    email,
    html,
    subject: newsletter.title,
    source: "optin",
  });

  if (!sent) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  await markOptInSent(permissionResult.permissionId, email, newsletterId);

  return NextResponse.redirect(new URL("/", request.url));
}
