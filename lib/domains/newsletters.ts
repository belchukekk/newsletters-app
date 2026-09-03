import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/server/db";
import { redis } from "@/lib/server/redis";

// Port of NewsletterCloudSQL.php — see docs/LEGACY_APP_INVENTORY.md.

export type Newsletter = {
  id: string;
  title: string;
  description: string;
  frequency: string;
  imageUrl: string;
  permission: string;
  defaultStatus: number;
  published: number;
  active: number;
};

const NEWSLETTER_DATA_CACHE_KEY = "newsletter_data";
const NEWSLETTER_DATA_ADMIN_CACHE_KEY = "newsletter_data_admin";
const NEWSLETTER_DATA_TTL_SECONDS = 7200;
const DEFAULT_IMAGE_URL = "/assets/img/newsletter/default.jpg";
const DEFAULT_PERMISSION_TEXT =
  "Ja tak, jeg vil gerne modtage særtilbud fra Kristeligt Dagblad på brev, telefon eller e-mail (jeg kan nemt afmelde mig).";

interface NewsletterRow extends RowDataPacket {
  id: string;
  title: string;
  description: string;
  frequency: string;
  image_url: string | null;
  permission: string | null;
  default_status: number;
  published: number;
  active: number;
}

function prepareRow(row: NewsletterRow): Newsletter {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    frequency: row.frequency,
    imageUrl: row.image_url || DEFAULT_IMAGE_URL,
    permission: row.permission || DEFAULT_PERMISSION_TEXT,
    defaultStatus: row.default_status,
    published: row.published,
    active: row.active,
  };
}

async function queryNewsletters(
  cacheKey: string,
  publishedOnly: boolean
): Promise<Newsletter[]> {
  const cached = await redis.get<Newsletter[]>(cacheKey);
  if (cached) return cached;

  const pool = await getPool();
  const [rows] = await pool.query<NewsletterRow[]>(
    `SELECT newsletter AS id,
            newsletter_title AS title,
            newsletter_description AS description,
            newsletter_frequency AS frequency,
            newsletter_thumbnail AS image_url,
            newsletter_permission AS permission,
            default_status,
            published,
            active
     FROM kd_customer.config_newsletter
     WHERE active = 1 ${publishedOnly ? "AND published = 1" : ""}
     ORDER BY -priority DESC, newsletter_title ASC`
  );

  const newsletters = rows.map(prepareRow);
  if (newsletters.length > 0) {
    await redis.set(cacheKey, newsletters, { ex: NEWSLETTER_DATA_TTL_SECONDS });
  }
  return newsletters;
}

// Published, active newsletters for anonymous/public listing — matches the
// old app's non-admin, non-unsubscribing query path (WHERE ... AND published=1).
export function getPublishedNewsletters(): Promise<Newsletter[]> {
  return queryNewsletters(NEWSLETTER_DATA_CACHE_KEY, true);
}

// All active newsletters (including unpublished) for the admin editor —
// matches the old app's isAdmin=true query path, own cache key/entry.
export function getAdminNewsletters(): Promise<Newsletter[]> {
  return queryNewsletters(NEWSLETTER_DATA_ADMIN_CACHE_KEY, false);
}

// Both list caches must be cleared together after any write — the old app's
// /clear-newsletter-cache only cleared the public key and left the admin one
// stale; see docs/LEGACY_APP_INVENTORY.md's "known issues" #3.
export async function invalidateNewsletterCache(): Promise<void> {
  await Promise.all([
    redis.del(NEWSLETTER_DATA_CACHE_KEY),
    redis.del(NEWSLETTER_DATA_ADMIN_CACHE_KEY),
  ]);
}

export type NewsletterUpdate = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  published: boolean;
};

// Port of AdminController::saveNewsletterAction's per-row UPDATE — the new
// app calls this once per card (its own Server Action), not once for every
// row in a single giant POST, to structurally fix the old app's lost-update
// race between concurrent admin edits (see PLAN.md).
export async function updateNewsletter(update: NewsletterUpdate): Promise<void> {
  const pool = await getPool();
  await pool.query(
    `UPDATE kd_customer.config_newsletter
     SET newsletter_title = ?, newsletter_description = ?, newsletter_thumbnail = ?, published = ?
     WHERE newsletter = ?`,
    [
      update.title,
      update.description,
      update.imageUrl,
      update.published ? 1 : 0,
      update.id,
    ]
  );
}

// Port of AdminController::reorderNewslettersAction — priority = position in
// the given order (1-based), matching the "-priority DESC" list ordering.
export async function reorderNewsletters(orderedIds: string[]): Promise<void> {
  const pool = await getPool();
  await Promise.all(
    orderedIds.map((id, index) =>
      pool.query(
        `UPDATE kd_customer.config_newsletter SET priority = ? WHERE newsletter = ?`,
        [index + 1, id]
      )
    )
  );
}

// Resolves an anonymous "csid" (from a Drupal-issued subscribe link) to an
// email via kd_customer.cv_email — port of NewsletterCloudSQL::getEmailFromCsid.
export async function getEmailFromCsid(csid: string): Promise<string> {
  const pool = await getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT email FROM kd_customer.cv_email WHERE identifier = ? LIMIT 1`,
    [csid]
  );
  return (rows[0]?.email as string | undefined) ?? "";
}
