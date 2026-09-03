import { createHash } from "crypto";

// Port of MailChimpService.php / MailchimpApiClient.php — only used to fetch
// a campaign's HTML as an opt-in email template, never for list/subscriber
// management or actual sending (Notifier does the sending).
const TEMPLATE_FIRST_OPT_IN_MAIL = "298bd510dc";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function getCampaignContent(campaignId: string): Promise<{ html: string }> {
  const host = requireEnv("MAILCHIMP_HOST");
  const key = requireEnv("MAILCHIMP_API_KEY");
  const response = await fetch(`${host}/campaigns/${campaignId}/content`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`username:${key}`).toString("base64")}`,
    },
  });
  return response.json();
}

// Port of MailChimpService::getOptinUrl — chk = md5(permissionId+mail).
function getOptinUrl(permissionId: string, mail: string): string {
  const checksum = createHash("md5").update(`${permissionId}${mail}`, "utf8").digest("hex");
  return `https://nyhedsbreve.kristeligt-dagblad.dk/confirm-subscription?id=${permissionId}&chk=${checksum}`;
}

// Port of MailChimpService::getTemplateBody — fetches the campaign HTML and
// replaces its *|TOKEN|* placeholders. UNSUB_URL is '#' in the old app too
// (a known-broken stub, see docs/LEGACY_APP_INVENTORY.md's known issues) —
// preserved as-is rather than silently "fixing" behavior nobody asked for.
export async function getOptInEmailHtml(params: {
  mail: string;
  permissionId: string;
  newsletterTitle: string;
  newsletterFrequency: string;
  templateId?: string;
}): Promise<string> {
  const {
    mail,
    permissionId,
    newsletterTitle,
    newsletterFrequency,
    templateId = TEMPLATE_FIRST_OPT_IN_MAIL,
  } = params;

  const { html } = await getCampaignContent(templateId);

  const replacements: Record<string, string> = {
    USER_EMAIL: mail,
    CURRENT_YEAR: String(new Date().getFullYear()),
    OPTIN_URL: getOptinUrl(permissionId, mail),
    UNSUB_URL: "#",
    WEBSITE: '<a href="https://kristeligt-dagblad.dk" target="_BLANK">kristeligt-dagblad.dk</a>',
    NEWSLETTER_TITLE: newsletterTitle,
    NEWSLETTER_FREQUENCY: newsletterFrequency,
  };

  return Object.entries(replacements).reduce(
    (body, [pattern, replacement]) => body.split(`*|${pattern}|*`).join(replacement),
    html
  );
}
