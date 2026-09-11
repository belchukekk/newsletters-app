// Transactional email via Mandrill (Mailchimp's transactional-send API — a
// different product from the marketing Campaigns API this app used to read
// a template from, which was retired). Templates themselves are configured
// and maintained in the Mandrill dashboard; this only supplies merge
// variables and triggers the send. API reference:
// https://mailchimp.com/developer/transactional/api/messages/send-using-template/

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

type MergeVar = { name: string; content: string };

type SendResult = {
  email: string;
  status: "sent" | "queued" | "scheduled" | "rejected" | "invalid";
  reject_reason?: string;
};

async function sendTemplate(templateName: string, to: string, mergeVars: MergeVar[]): Promise<void> {
  const response = await fetch("https://mandrillapp.com/api/1.0/messages/send-template.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: requireEnv("MANDRILL_API_KEY"),
      template_name: templateName,
      template_content: [],
      message: {
        from_email: requireEnv("MANDRILL_FROM_EMAIL"),
        from_name: process.env.MANDRILL_FROM_NAME || undefined,
        to: [{ email: to, type: "to" }],
        global_merge_vars: mergeVars,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Mandrill API error: ${response.status} ${response.statusText}`);
  }

  // A 200 here only means Mandrill accepted the API call — per-recipient
  // outcome is in the response body, and "rejected"/"invalid" (e.g. no
  // verified sending domain, a suppressed address) are silent unless checked
  // here too. Found by testing: an invalid-sender rejection returned HTTP 200
  // with an empty catch upstream, so the email never sent and nothing ever
  // logged it.
  const results = (await response.json()) as SendResult[];
  const failed = results.filter((r) => r.status === "rejected" || r.status === "invalid");
  if (failed.length > 0) {
    throw new Error(
      `Mandrill rejected the send: ${failed.map((r) => `${r.email} (${r.reject_reason ?? r.status})`).join(", ")}`
    );
  }
}

type OptInEmailParams = {
  email: string;
  confirmUrl: string;
  unsubscribeUrl: string;
  newsletterTitle: string;
  newsletterFrequency: string;
};

function optInMergeVars(params: OptInEmailParams): MergeVar[] {
  return [
    { name: "USER_EMAIL", content: params.email },
    { name: "OPTIN_URL", content: params.confirmUrl },
    { name: "UNSUBSCRIBE_URL", content: params.unsubscribeUrl },
    { name: "NEWSLETTER_TITLE", content: params.newsletterTitle },
    { name: "NEWSLETTER_FREQUENCY", content: params.newsletterFrequency },
    { name: "WEBSITE", content: "kristeligt-dagblad.dk" },
    { name: "CURRENT_YEAR", content: String(new Date().getFullYear()) },
  ];
}

// Sent right after an anonymous /save subscribe — asks the recipient to
// confirm via the /confirm-subscription link (see
// lib/domains/optin.ts's buildOptInConfirmUrl/buildNewsletterUnsubscribeUrl).
export async function sendOptInEmail(params: OptInEmailParams): Promise<void> {
  await sendTemplate(requireEnv("MANDRILL_TEMPLATE_OPTIN"), params.email, optInMergeVars(params));
}

// A follow-up resend of the *same* opt-in ask ("we emailed you yesterday...")
// for recipients who haven't clicked the confirm link yet — not a
// post-confirmation email. ("Double opt-in" names the overall two-step
// signup+confirm process this belongs to, not this specific email — this is
// just the follow-up nudge within it.) Same merge vars/content as
// sendOptInEmail, just a different template with different framing copy at
// the top.
//
// Nothing in this app currently triggers this on a schedule — something
// needs to decide "it's been ~1 day and this permission event still has no
// optin_confirmed", which means either a cron job here or an external
// automation (e.g. ActiveCampaign) driving it. Wire up the actual trigger
// before relying on this.
export async function sendOptInFollowUpEmail(params: OptInEmailParams): Promise<void> {
  await sendTemplate(
    requireEnv("MANDRILL_TEMPLATE_OPTIN_FOLLOWUP"),
    params.email,
    optInMergeVars(params)
  );
}
