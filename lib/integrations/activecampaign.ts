// Per-contact activity history, fetched live from ActiveCampaign's own REST
// API — replaces the old BigQuery-based dbt_email.summary query (a warehouse
// round-trip for data ActiveCampaign already holds directly). Endpoints per
// https://developers.activecampaign.com/reference/list-all-contacts and
// https://developers.activecampaign.com/reference/list-contact-activities.
//
// AC's `activities` endpoint returns generic CRM activity records
// (reference_type/reference_action pairs, e.g. "SubscriberEmail"/"open") —
// it is not a fixed send/open/bounce enum, and the exact action strings for
// email tracking aren't published in AC's docs. Rather than guess a mapping
// that could silently mislabel an event, this passes reference_type/
// reference_action through as-is; the admin UI decides how to badge them.
// Verify the exact strings against a real account's response and tighten
// this if a cleaner classification turns out to be worth it.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function acFetch<T>(path: string): Promise<T> {
  const baseUrl = requireEnv("ACTIVECAMPAIGN_API_URL").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Api-Token": requireEnv("ACTIVECAMPAIGN_API_TOKEN") },
  });
  if (!response.ok) {
    throw new Error(`ActiveCampaign API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

type AcContact = { id: string; email: string };

async function findContactId(email: string): Promise<string | null> {
  const result = await acFetch<{ contacts: AcContact[] }>(
    `/api/3/contacts?email=${encodeURIComponent(email)}`
  );
  return result.contacts[0]?.id ?? null;
}

type AcActivity = {
  id: string;
  tstamp: string;
  reference_type: string;
  reference_action: string;
};

export type EmailEvent = {
  timestamp: string;
  // Raw ActiveCampaign reference_action (e.g. "open", "subscribe") — see the
  // file header on why this isn't normalized to a fixed enum.
  eventType: string;
  referenceType: string;
};

// Port of the admin dashboard's "?events=1" panel — was BigQuerySQL::getEvents,
// now reads straight from ActiveCampaign.
export async function getEmailEventHistory(email: string): Promise<EmailEvent[]> {
  const contactId = await findContactId(email);
  if (!contactId) return [];

  const result = await acFetch<{ activities: AcActivity[] }>(
    `/api/3/activities?contact=${contactId}&orders[tstamp]=DESC`
  );

  return result.activities.map((activity) => ({
    timestamp: activity.tstamp,
    eventType: activity.reference_action,
    referenceType: activity.reference_type,
  }));
}
