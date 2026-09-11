import { redis } from "@/lib/server/redis";

// New feature (not a legacy port): a marketing-configurable grid that
// replaces the frontpage's newsletter list entirely. One row per grid row,
// each with 1-4 slots; each slot promotes one newsletter, optionally with a
// custom image instead of the newsletter's own thumbnail, and an optional
// "fallback" promotion shown instead when the viewer is already subscribed
// to the primary one.
//
// Stored as a single non-expiring Redis key rather than a new table in
// kd_customer (KD's shared production customer database) — this is app
// configuration, not customer data, and Upstash Redis is a durable, persisted
// store, not just a TTL'd cache, so this is safe as the source of truth.
//
// Superseded by the Puck-powered homepage (see lib/domains/homepage.ts),
// which folds a grid's rows into its own NewsletterGrid component's props
// instead of this standalone key. getPromoGrid stays here on purpose: it's
// still called once, read-only, to seed the new homepage content the first
// time it's requested with nothing configured yet — this is intentionally
// kept, not dead code. Writing to this key (savePromoGrid) and resolving it
// per-viewer (resolvePromoGridForViewer/resolveSlot) were removed once the
// Puck homepage took over both jobs — see Newsletter.tsx/Promotion.tsx.
const PROMO_GRID_KEY = "promo_grid:current";

export type PromoEntry = {
  newsletterId: string;
  customImageUrl?: string;
};

export type PromoSlot = {
  id: string;
  primary: PromoEntry;
  fallback?: PromoEntry;
};

export type PromoRow = {
  id: string;
  columns: 1 | 2 | 3 | 4;
  slots: PromoSlot[];
};

export type PromoGrid = {
  rows: PromoRow[];
};

const EMPTY_GRID: PromoGrid = { rows: [] };

// The UTM param a marketing link uses to carry a newsletter id/slug for the
// top-row promotion below. Centralized here so there's exactly one place to
// change if a different param name (e.g. utm_content) turns out to be the
// right convention instead.
export const UTM_NEWSLETTER_PARAM = "utm_campaign";

export async function getPromoGrid(): Promise<PromoGrid> {
  const grid = await redis.get<PromoGrid>(PROMO_GRID_KEY);
  return grid ?? EMPTY_GRID;
}
