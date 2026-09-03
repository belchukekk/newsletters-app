import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/server/db";
import { redis } from "@/lib/server/redis";
import { logToBbl } from "@/lib/integrations/bbl";

// Port of NotificationCloudSQL.php — push notification preferences,
// identified by device push_token rather than a user session.

const SUBSCRIPTION_CACHE_TTL_SECONDS = 3600;

function subsCacheKey(pushToken: string): string {
  return `subs_${pushToken}`;
}

export type PushList = {
  id: string;
  title: string;
  description: string;
  defaultStatus: number;
  published: number;
  priority: number;
};

interface PushListRow extends RowDataPacket {
  push_list: string;
  push_list_title: string;
  push_list_description: string | null;
  published: number;
  default_status: number;
  priority: number;
}

// Port of NotificationCloudSQL::getPushListsInfo.
export async function getPushLists(): Promise<PushList[]> {
  const pool = await getPool();
  const [rows] = await pool.query<PushListRow[]>(
    `SELECT * FROM kd_customer.config_push_list WHERE published = 1 ORDER BY priority ASC`
  );
  return rows.map((row) => ({
    id: row.push_list,
    title: row.push_list_title,
    description: row.push_list_description ?? "",
    defaultStatus: row.default_status,
    published: row.published,
    priority: row.priority,
  }));
}

interface PushSubscriptionRow extends RowDataPacket {
  list: string;
  status: number;
}

// Port of NotificationCloudSQL::getSubscriptions — cache-first (Redis hash
// keyed by push_token), lazy-populate on miss from push_list_current.
async function getSubscriptions(pushToken: string): Promise<Record<string, number>> {
  const key = subsCacheKey(pushToken);
  const cached = await redis.hgetall<Record<string, string>>(key);
  if (cached) {
    return Object.fromEntries(Object.entries(cached).map(([id, status]) => [id, Number(status)]));
  }

  const pool = await getPool();
  const [rows] = await pool.query<PushSubscriptionRow[]>(
    `SELECT * FROM push_list_current WHERE push_token = ?`,
    [pushToken]
  );

  const result: Record<string, number> = {};
  for (const row of rows) result[row.list] = row.status;

  if (Object.keys(result).length > 0) {
    await redis.hset(key, result);
    await redis.expire(key, SUBSCRIPTION_CACHE_TTL_SECONDS);
  }
  return result;
}

// Port of NotificationCloudSQL::getNotificationSettings — merges the
// device's current subscriptions with each list's default_status for any
// list it hasn't set an explicit preference for.
export async function getNotificationSettings(
  pushToken: string,
  lists: PushList[]
): Promise<Record<string, number>> {
  const subscriptions = await getSubscriptions(pushToken);
  const settings: Record<string, number> = { ...subscriptions };
  for (const list of lists) {
    if (!(list.id in settings)) settings[list.id] = list.defaultStatus;
  }
  return settings;
}

// Port of NotificationCloudSQL::setSubscriptionCache — cache-only, no direct
// SQL write. Matches subscriptions.ts's email-list pattern: the real
// push_list_current row is written asynchronously from the BBL event, not
// by this app directly.
export async function setPushSubscriptionCache(
  pushToken: string,
  list: string,
  subscribed: boolean
): Promise<void> {
  const key = subsCacheKey(pushToken);
  await redis.hset(key, { [list]: subscribed ? 1 : 0 });
  await redis.expire(key, SUBSCRIPTION_CACHE_TTL_SECONDS);
}

// Port of the /pushbeskeder POST BBL payload — subscribe uses plural `lists`
// (array), unsubscribe uses singular `list`, exactly as in the old app.
export async function logPushPermission(params: {
  pushToken: string;
  list: string;
  sys: boolean;
  subscribe: boolean;
}): Promise<void> {
  const { pushToken, list, sys, subscribe } = params;
  const payload: Record<string, unknown> = {
    push_token: pushToken,
    source: requireEnv("BBL_SOURCE"),
    origin: "newsletter",
    sys: sys ? 1 : 0,
  };
  if (subscribe) {
    payload.event = "permission_push";
    payload.lists = [list];
  } else {
    payload.event = "unsubscribe_push";
    payload.list = list;
  }

  await logToBbl(payload, "https://nyhedsbreve.kristeligt-dagblad.dk");
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
