import { readFileSync } from "fs";
import { BigQuery } from "@google-cloud/bigquery";

// Port of BigQuerySQL.php — read-only: per-email send/open/bounce event
// history (dbt_email.summary) and GDPR audit data (permission.gdpr_overview).
// The old app sprintf'd the email straight into the SQL string; this uses
// BigQuery's named query params instead — same query, safer construction.

const EVENT_COUNT = 50;
const ACTIVE_CAMPAIGN_URL = "https://k514.activehosted.com/p_v.php";

let client: BigQuery | undefined;

// Unlike the Cloud SQL connector (db.ts), BigQuery's client does not
// reliably infer `projectId` from ADC/GOOGLE_APPLICATION_CREDENTIALS on its
// own — confirmed by testing: an unqualified `new BigQuery()` fails with an
// unrelated-looking "Cannot parse ... as CloudRegion" error while resolving
// its default project. So both credential paths here load the full service
// account JSON themselves and pass `projectId` explicitly.
function loadCredentials(): { credentials: Record<string, unknown>; projectId: string } {
  const inlineJson = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON;
  const raw = inlineJson ?? readFileSync(requireEnv("GOOGLE_APPLICATION_CREDENTIALS"), "utf8");
  const credentials = JSON.parse(raw);
  return { credentials, projectId: credentials.project_id };
}

function getClient(): BigQuery {
  if (!client) {
    const { credentials, projectId } = loadCredentials();
    client = new BigQuery({ credentials, projectId });
  }
  return client;
}

type BigQueryDate = { value: string };

function formatBigQueryTimestamp(value: unknown): string {
  if (value && typeof value === "object" && "value" in value) {
    return String((value as BigQueryDate).value);
  }
  return String(value ?? "");
}

export type EmailEvent = {
  timestamp: string;
  eventType: "sent" | "opened" | "bounced";
  url: string;
  list: unknown;
  campaignName: unknown;
  [key: string]: unknown;
};

// Port of BigQuerySQL::getEvents / prepareData — used by /admin?events=1.
export async function getEmailEventHistory(email: string): Promise<EmailEvent[]> {
  const [rows] = await getClient().query({
    query: `SELECT * FROM dbt_email.summary WHERE email = @email ORDER BY sent_ts DESC LIMIT @limit`,
    params: { email, limit: EVENT_COUNT },
  });

  return (rows as Record<string, unknown>[]).map((row) => {
    const eventType = row.hard_bounced ? "bounced" : row.opened ? "opened" : "sent";
    return {
      ...row,
      timestamp: formatBigQueryTimestamp(row.sent_ts),
      eventType,
      url: `${ACTIVE_CAMPAIGN_URL}?l=${row.list_id}&c=${row.campaign_id}&m=${row.message_id}`,
      list: row.list,
      campaignName: row.campaign_name,
    } as EmailEvent;
  });
}

export type GdprEvent = {
  timestamp: string;
  event: unknown;
  eventDesc: unknown;
  info: unknown;
  [key: string]: unknown;
};

// Port of BigQuerySQL::getGdprData / prepareGdprData — used by /gdpr and
// /gdpr/delete's event history display.
export async function getGdprOverview(email: string): Promise<GdprEvent[]> {
  const [rows] = await getClient().query({
    query: `SELECT * FROM permission.gdpr_overview WHERE email = @email ORDER BY timestamp DESC`,
    params: { email },
  });

  return (rows as Record<string, unknown>[]).map((row) => ({
    ...row,
    timestamp: formatBigQueryTimestamp(row.timestamp),
    event: row.event,
    eventDesc: row.event_desc,
    info: row.info,
  })) as GdprEvent[];
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
