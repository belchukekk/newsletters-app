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
    // build the confirm-subscription link and to later update the same doc.
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

// Port of the second BBL log in Controller::newsletterLogDataAction (/save) —
// updates the same event doc created by handlePermission() with optin_sent,
// once the opt-in email has actually been sent via Notifier.
export async function markOptInSent(
  permissionId: string,
  email: string,
  newsletterId: string
): Promise<void> {
  await logToBbl(
    {
      event: "permission",
      mail: email,
      origin: "newsletter",
      source: requireEnv("BBL_SOURCE"),
      lists: [newsletterId, "marketing"],
      optin_sent: Math.floor(Date.now() / 1000),
    },
    "https://nyhedsbreve.kristeligt-dagblad.dk",
    `bigbucket/${permissionId}`
  );
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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
