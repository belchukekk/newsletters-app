import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/server/db";
import { redis } from "@/lib/server/redis";
import { logToBbl } from "@/lib/integrations/bbl";

// Port of UserList.php — see docs/LEGACY_APP_INVENTORY.md and the phase-4
// research this was built from. Two things worth stating up front, because
// they're the opposite of what a naive port would assume:
//
// 1. This module never writes to email_list_current_mv. All "writes" here
//    are Redis-only; the actual DB row is written asynchronously by BBL's
//    downstream consumer, outside this app entirely. Adding a direct DB
//    UPSERT here would create a second, racing write path — don't.
// 2. The legacy cache key was md5(email) with no case normalization, which
//    let `Foo@x.com`/`foo@x.com` diverge from MySQL's case-insensitive
//    column collation. Since this cache is a fresh Upstash instance (not
//    shared with the old app — see PLAN.md's Redis decision), there's no
//    compatibility cost to normalizing casing here, so we do.

const CACHE_TTL_SECONDS = 7200;

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

function cacheKey(email: string): string {
  return `subscriptions:${normalize(email)}`;
}

interface SubscriptionRow extends RowDataPacket {
  list: string;
}

// Port of UserList::getPersistentData (non-admin path) — direct DB read,
// seeds the cache as a side effect (only when non-empty, matching legacy).
async function getPersistentSubscriptions(email: string): Promise<string[]> {
  const pool = await getPool();
  const [rows] = await pool.query<SubscriptionRow[]>(
    `SELECT list FROM kd_customer.email_list_current_mv WHERE email = ? AND status = 1`,
    [email]
  );
  const ids = rows.map((row) => row.list);
  if (ids.length > 0) {
    await redis.set(cacheKey(email), ids, { ex: CACHE_TTL_SECONDS });
  }
  return ids;
}

// Port of UserList::getUserLists (non-admin) — cache-first, lazy-populate on
// miss. A warm cache is trusted unconditionally for its 2h TTL; there is no
// read-through revalidation against the DB.
export async function getUserSubscriptions(email: string): Promise<string[]> {
  const cached = await redis.get<string[]>(cacheKey(email));
  if (cached !== null) return cached;
  return getPersistentSubscriptions(email);
}

// Port of UserList::setCacheData's toggle semantics. An absent cache entry
// no-ops on remove (nothing to remove) but seeds a fresh one on add; an
// existing entry (even an empty array) is always rewritten with a fresh TTL.
async function setSubscriptionCache(
  email: string,
  newsletterId: string,
  subscribe: boolean
): Promise<void> {
  const key = cacheKey(email);
  const current = await redis.get<string[]>(key);

  if (current === null) {
    if (!subscribe) return;
    await redis.set(key, [newsletterId], { ex: CACHE_TTL_SECONDS });
    return;
  }

  const next = subscribe
    ? current.includes(newsletterId)
      ? current
      : [...current, newsletterId]
    : current.filter((id) => id !== newsletterId);
  await redis.set(key, next, { ex: CACHE_TTL_SECONDS });
}

// Port of UserList::unsubscribe — cache-only, no BBL event logged directly
// (used by the /unsubscribe route). Seeds the cache from the DB first if it
// doesn't exist yet, matching legacy exactly (the seed's return value is
// discarded there too — it's only for the side effect).
export async function unsubscribeCacheOnly(
  email: string,
  newsletterId: string
): Promise<void> {
  const existing = await redis.get<string[]>(cacheKey(email));
  if (existing === null) {
    await getPersistentSubscriptions(email);
  }
  await setSubscriptionCache(email, newsletterId, false);
}

export type HandlePermissionParams = {
  email: string;
  authenticated: boolean;
  adminEmail?: string;
  newsletterId: string;
  newsletterTitle: string;
  subscribe: boolean;
};

export type HandlePermissionResult = { ok: boolean; permissionId?: string };

// Port of UserList::handlePermission, used by /saveajax (authenticated) and
// /save (unauthenticated). Updates the cache, then logs the corresponding
// BBL event — that event is what ultimately drives the async DB write.
export async function handlePermission(
  params: HandlePermissionParams
): Promise<HandlePermissionResult> {
  const { email, authenticated, adminEmail, newsletterId, newsletterTitle, subscribe } = params;

  await setSubscriptionCache(email, newsletterId, subscribe);

  const payload: Record<string, unknown> = {
    mail: email,
    origin: "newsletter",
    source: requireEnv("BBL_SOURCE"),
  };
  if (adminEmail) payload.admin = adminEmail;

  if (subscribe) {
    payload.event = "permission";
    payload.lists = authenticated ? [newsletterId] : [newsletterId, "marketing"];
  } else {
    payload.event = "unsubscribe";
    payload.list = newsletterTitle;
  }
  if (authenticated) {
    payload.optin_confirmed = Math.floor(Date.now() / 1000);
  }

  const responseText = await logToBbl(payload, "https://nyhedsbreve.kristeligt-dagblad.dk");

  if (!authenticated && subscribe) {
    // The unauthenticated /save flow needs the logged event's own _id to
    // build the opt-in email's confirm link (see
    // lib/domains/optin.ts's buildOptInConfirmUrl).
    try {
      const parsed = JSON.parse(responseText);
      const permissionId = parsed?.isLogged?.id;
      return typeof permissionId === "string" ? { ok: true, permissionId } : { ok: false };
    } catch {
      return { ok: false };
    }
  }

  return { ok: true };
}

// "pause" is a special reason value: it additionally logs a future-dated
// permission event so the subscription auto-resumes. Port of
// Controller::unsubscribeReasons — see PLAN.md/legacy inventory.
export async function logUnsubscribeFeedback(params: {
  email: string;
  newsletterId: string;
  reasons: string[];
  pausePeriodWeeks: number;
}): Promise<void> {
  const { email, newsletterId, reasons, pausePeriodWeeks } = params;

  await logToBbl(
    {
      event: "unsubscribe_reasons",
      mail: email,
      origin: "newsletter",
      source: requireEnv("BBL_SOURCE"),
      list: newsletterId,
      reasons,
    },
    "https://nyhedsbreve.kristeligt-dagblad.dk"
  );

  if (reasons.includes("pause") && pausePeriodWeeks > 0) {
    const now = Math.floor(Date.now() / 1000);
    await logToBbl(
      {
        event: "permission",
        mail: email,
        source: requireEnv("BBL_SOURCE"),
        lists: [newsletterId],
        valid_from: now + pausePeriodWeeks * 7 * 24 * 60 * 60,
        optin_confirmed: now,
        optin_sent: now,
      },
      "https://nyhedsbreve.kristeligt-dagblad.dk"
    );
  }
}

// --- Admin-only additions (phase 5) ---

export type AdminSubscriptionRow = {
  id: string;
  source: string;
  timestamp: string;
  status: number;
  cacheEvent: "subscribed" | "unsubscribed" | null;
};

interface AdminSubscriptionRawRow extends RowDataPacket {
  list: string;
  source: string;
  timestamp: string;
  status: number;
}

// Port of UserList::getPersistentData($email, isAdmin=true) — unlike the
// non-admin path, this has no `status = 1` filter and never touches the
// cache.
async function getPersistentSubscriptionsAdmin(
  email: string
): Promise<AdminSubscriptionRow[]> {
  const pool = await getPool();
  const [rows] = await pool.query<AdminSubscriptionRawRow[]>(
    `SELECT list, source, timestamp, status FROM kd_customer.email_list_current_mv WHERE email = ?`,
    [email]
  );
  return rows.map((row) => ({
    id: row.list,
    source: row.source,
    timestamp: String(row.timestamp),
    status: row.status,
    cacheEvent: null,
  }));
}

// Port of UserList::getUserListsAdmin — a three-way, display-only merge of
// persistent DB rows against the cache (cache wins for freshness). This
// never writes back to the DB; it only annotates rows so the admin dashboard
// can show where cache and DB have drifted.
export async function getUserSubscriptionsAdmin(
  email: string
): Promise<AdminSubscriptionRow[]> {
  const persistentData = await getPersistentSubscriptionsAdmin(email);
  const cachedData = await redis.get<string[]>(cacheKey(email));

  if (!cachedData || cachedData.length === 0) {
    return persistentData;
  }

  const persistentIdsAll: string[] = [];
  const persistentIdsPublished: string[] = [];
  const result = persistentData.map((row) => ({ ...row }));

  for (const row of result) {
    persistentIdsAll.push(row.id);
    if (row.status === 1) persistentIdsPublished.push(row.id);
    if (cachedData.includes(row.id) && !row.status) {
      row.status = 1;
      row.cacheEvent = "subscribed";
    }
  }

  const cacheAdded = cachedData.filter((id) => !persistentIdsAll.includes(id));
  for (const id of cacheAdded) {
    result.push({ id, source: "", timestamp: "", status: 1, cacheEvent: "subscribed" });
  }

  const cacheRemoved = persistentIdsPublished.filter((id) => !cachedData.includes(id));
  for (const row of result) {
    if (cacheRemoved.includes(row.id)) {
      row.status = 0;
      row.cacheEvent = "unsubscribed";
    }
  }

  return result;
}

const BLACKLIST_CACHE_TTL_SECONDS = 7200;

function blacklistCacheKey(email: string): string {
  return `blacklist:${normalize(email)}`;
}

interface BlacklistRow extends RowDataPacket {
  source: string;
}

// Port of NewsletterCloudSQL::getBlacklist + UserList::getBlacklist —
// DB-first, cache-fallback (the opposite pattern from subscriptions, which
// are cache-first). Blacklist is display-only in the old app and stays that
// way here: it never gates subscribe/unsubscribe.
export async function getBlacklistSource(email: string): Promise<string | null> {
  const pool = await getPool();
  const [rows] = await pool.query<BlacklistRow[]>(
    `SELECT source FROM email_blacklist_complete WHERE email = ?`,
    [email]
  );
  const source = rows[0]?.source;
  if (source) return source;
  return (await redis.get<string>(blacklistCacheKey(email))) ?? null;
}

// Port of UserList::setBlacklistCache.
export async function setBlacklistCache(
  email: string,
  value: string | null
): Promise<void> {
  const key = blacklistCacheKey(email);
  if (value) {
    await redis.set(key, value, { ex: BLACKLIST_CACHE_TTL_SECONDS });
  } else {
    await redis.del(key);
  }
}

// Port of the BBL payload in AdminController::blacklistLogAction.
export async function logBlacklistEvent(params: {
  email: string;
  adminEmail: string;
  status: boolean;
}): Promise<void> {
  await logToBbl(
    {
      mail: params.email,
      event: "blacklist",
      status: params.status,
      source: "nl_admin",
      admin: params.adminEmail,
    },
    "https://nyhedsbreve.kristeligt-dagblad.dk"
  );
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
