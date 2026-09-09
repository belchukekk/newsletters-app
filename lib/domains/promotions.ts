import { redis } from "@/lib/server/redis";
import { getUserSubscriptions } from "@/lib/domains/subscriptions";
import type { Newsletter } from "@/lib/domains/newsletters";

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

export async function savePromoGrid(grid: PromoGrid): Promise<void> {
  await redis.set(PROMO_GRID_KEY, grid);
}

export type ResolvedPromoSlot = {
  id: string;
  newsletter: Newsletter;
  imageUrl: string;
};

export type ResolvedPromoRow = {
  id: string;
  columns: 1 | 2 | 3 | 4;
  slots: ResolvedPromoSlot[];
};

// Resolves one slot for a viewer: swaps to its fallback promotion when
// already subscribed to the primary, and drops entirely (returns null)
// rather than rendering a redundant "subscribe" prompt when either the
// resolved newsletter id no longer exists (e.g. deleted since the grid was
// configured), or the viewer is already subscribed to everything the slot
// could offer (the primary, and the fallback too if one is configured) —
// showing the fallback only helps when it's something the viewer doesn't
// already have either.
function resolveSlot(
  slot: PromoSlot,
  newslettersById: Map<string, Newsletter>,
  subscribedIds: string[]
): ResolvedPromoSlot | null {
  const subscribedToPrimary = subscribedIds.includes(slot.primary.newsletterId);
  if (!subscribedToPrimary) {
    const newsletter = newslettersById.get(slot.primary.newsletterId);
    if (!newsletter) return null;
    return {
      id: slot.id,
      newsletter,
      imageUrl: slot.primary.customImageUrl || newsletter.imageUrl,
    };
  }

  if (!slot.fallback || subscribedIds.includes(slot.fallback.newsletterId)) {
    return null;
  }
  const newsletter = newslettersById.get(slot.fallback.newsletterId);
  if (!newsletter) return null;
  return {
    id: slot.id,
    newsletter,
    imageUrl: slot.fallback.customImageUrl || newsletter.imageUrl,
  };
}

export type ResolvedPromoGrid = {
  // Set only when utmNewsletterId was given AND resolved to something
  // visible — the caller uses this to know whether to render the "promoted"
  // layout (uniform 2-column rest-of-grid) or the normal one (each row at
  // its configured column count).
  promotedSlot: ResolvedPromoSlot | null;
  rows: ResolvedPromoRow[];
  // The viewer's own subscribed newsletter ids (empty when anonymous) — so
  // the page can render an inline toggle instead of a "Tilmeld" link for a
  // logged-in viewer, without a second cache read.
  subscribedIds: string[];
};

// Resolves the grid for a specific viewer (see resolveSlot for the
// subscribed/fallback rules). When `utmNewsletterId` is given (from a
// marketing link's UTM tag — see UTM_NEWSLETTER_PARAM), that newsletter is
// promoted to a full-width row at the top: if it's already configured as a
// slot's primary somewhere in the grid, that exact slot (fallback included)
// is pulled out of its normal position and re-resolved for the top row,
// rather than duplicating it in both places; if it isn't configured
// anywhere, it's promoted on its own with no fallback.
export async function resolvePromoGridForViewer(
  grid: PromoGrid,
  newsletters: Newsletter[],
  viewerEmail: string | null,
  utmNewsletterId?: string | null
): Promise<ResolvedPromoGrid> {
  const newslettersById = new Map(newsletters.map((n) => [n.id, n]));
  const subscribedIds = viewerEmail ? await getUserSubscriptions(viewerEmail) : [];

  let promotedSlotConfig: PromoSlot | undefined;
  let promotedRowId: string | undefined;
  if (utmNewsletterId) {
    for (const row of grid.rows) {
      const found = row.slots.find((slot) => slot.primary.newsletterId === utmNewsletterId);
      if (found) {
        promotedSlotConfig = found;
        promotedRowId = row.id;
        break;
      }
    }
  }

  let promotedSlot: ResolvedPromoSlot | null = null;
  if (utmNewsletterId) {
    const slotToPromote: PromoSlot = promotedSlotConfig ?? {
      id: `utm-${utmNewsletterId}`,
      primary: { newsletterId: utmNewsletterId },
    };
    promotedSlot = resolveSlot(slotToPromote, newslettersById, subscribedIds);
  }

  const rows: ResolvedPromoRow[] = [];
  for (const row of grid.rows) {
    const remainingSlots =
      row.id === promotedRowId
        ? row.slots.filter((slot) => slot.id !== promotedSlotConfig!.id)
        : row.slots;

    const slots = remainingSlots
      .map((slot) => resolveSlot(slot, newslettersById, subscribedIds))
      .filter((slot): slot is ResolvedPromoSlot => slot !== null);

    if (slots.length > 0) {
      rows.push({ id: row.id, columns: row.columns, slots });
    }
  }

  return { promotedSlot, rows, subscribedIds };
}
