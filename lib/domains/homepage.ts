import type { Data } from "@puckeditor/core";
import { redis } from "@/lib/server/redis";
import { getPromoGrid, type PromoGrid, type PromoRow } from "@/lib/domains/promotions";

// The public homepage's full content (hero + newsletter rows), authored via
// the Puck editor at /admin/homepage. Stored as a single non-expiring Redis
// key, same pattern as promo_grid:current before it (see promotions.ts) —
// this is app configuration, not customer data.
const HOMEPAGE_CONTENT_KEY = "homepage_content:current";

export type HomepageContent = { version: 3; data: Data };

type HomepageContentV1 = { version: 1; data: Data };
type HomepageContentV2 = { version: 2; data: Data };
type StoredHomepageContent = HomepageContent | HomepageContentV2 | HomepageContentV1;

function newId(): string {
  return crypto.randomUUID();
}

type PuckNode = { type: string; props: Record<string, unknown> & { id: string } };

// Shared by both the from-scratch seed and the v1→v3 migration below: turns
// the old rows/slots shape into Row components (one per row), each holding
// its slots' Newsletter components in ONE `items` slot (not capped at 4 —
// see Row.tsx). Row and slot ids are reused as the new components' ids —
// they were already unique.
function rowsToComponents(rows: PromoRow[]): PuckNode[] {
  return rows.map((row) => ({
    type: "Row",
    props: {
      id: row.id,
      columns: row.columns,
      items: row.slots.map((slot) => ({
        type: "Newsletter",
        props: {
          id: slot.id,
          entry: {
            newsletterId: slot.primary.newsletterId,
            customImageUrl: slot.primary.customImageUrl,
            fallback: slot.fallback
              ? { newsletterId: slot.fallback.newsletterId, customImageUrl: slot.fallback.customImageUrl }
              : undefined,
          },
        },
      })),
    },
  }));
}

// Only runs once: the first time the homepage-content key is read and found
// empty, seeded from whatever promo grid is already live in
// promo_grid:current (see promotions.ts) so the real, currently-configured
// newsletter arrangement isn't lost when this feature ships. promo_grid:current
// itself is never written to again after this — it stays purely as this
// one-time migration source, not dead code to clean up later.
function buildDefaultHomepageContent(grid: PromoGrid): HomepageContent {
  return {
    version: 3,
    data: {
      root: { props: {} },
      content: [
        { type: "Eyebrow", props: { id: newId(), text: "NYHEDSBREVE FRA KRISTELIGT DAGBLAD" } },
        { type: "Heading", props: { id: newId(), text: "Mere af det, der betyder noget", level: "h1" } },
        {
          type: "BodyText",
          props: {
            id: newId(),
            text: "Få udvalgte nyheder, skarpe analyser og fordybende fortællinger – direkte i din indbakke. Vælg de nyhedsbreve, der passer til dig.",
          },
        },
        {
          type: "Heading",
          props: { id: newId(), text: "Vælg de nyhedsbreve, der interesserer dig", level: "h2" },
        },
        ...rowsToComponents(grid.rows),
      ] as Data["content"],
    },
  };
}

// One-time migration for content published under the first version of this
// feature, where the whole grid lived in a single "NewsletterGrid"
// component's `rows` prop instead of native Row/Newsletter components —
// replaces that one node with the equivalent Row/Newsletter tree in place,
// leaving every other (already-published, hero) node untouched.
function migrateV1ToV3(v1: HomepageContentV1): HomepageContent {
  const content = v1.data.content.flatMap((node) => {
    const typed = node as unknown as PuckNode;
    if (typed.type === "NewsletterGrid") {
      const rows = (typed.props.rows as PromoRow[]) ?? [];
      return rowsToComponents(rows);
    }
    return [node];
  });
  return { version: 3, data: { ...v1.data, content: content as Data["content"] } };
}

function isPuckNodeArray(value: unknown): value is PuckNode[] {
  return (
    Array.isArray(value) &&
    value.every((item) => item && typeof item === "object" && "type" in item && "props" in item)
  );
}

// One-time migration for content published between Row gaining native Puck
// support and it gaining an unbounded `items` slot: reshapes each Row's
// col1..col4 slots into one `items` array (recursing into any nested slot,
// e.g. inside a TwoColumn, since a Row could in principle live there too),
// then merges consecutive same-`columns` Row nodes at each level into one —
// so a page that already has several same-width Rows stacked back to back
// (each capped at 4 items under the old shape) becomes one continuously
// wrapping grid instead of several separate ones each left with their own
// ragged last line.
function reshapeAndMergeRows(content: PuckNode[]): PuckNode[] {
  const withNestedSlotsFixed: PuckNode[] = content.map((node) => {
    const newProps: PuckNode["props"] = { ...node.props };
    for (const [key, value] of Object.entries(node.props)) {
      if (isPuckNodeArray(value)) {
        newProps[key] = reshapeAndMergeRows(value);
      }
    }
    return { type: node.type, props: newProps };
  });

  const reshaped: PuckNode[] = withNestedSlotsFixed.map((node) => {
    if (node.type !== "Row" || "items" in node.props) return node;
    // The old Row only ever rendered "columns" many of its four slots on the
    // public page (see the pre-redesign Row.tsx's `.slice(0, columns)`) — a
    // slot beyond that was configured but invisible. Carrying only
    // col1..col{columns} forward preserves exactly what was visible before;
    // pulling in every slot regardless of columns would surface content
    // that was previously hidden.
    const columnCount = Number(node.props.columns) || 4;
    const allCols = [node.props.col1, node.props.col2, node.props.col3, node.props.col4] as (
      | PuckNode[]
      | undefined
    )[];
    const items = ([] as PuckNode[]).concat(...allCols.slice(0, columnCount).map((col) => col ?? []));
    return { type: "Row", props: { id: node.props.id, columns: node.props.columns, items } };
  });

  const merged: PuckNode[] = [];
  for (const node of reshaped) {
    const prev = merged[merged.length - 1];
    if (node.type === "Row" && prev?.type === "Row" && prev.props.columns === node.props.columns) {
      (prev.props.items as PuckNode[]).push(...(node.props.items as PuckNode[]));
      continue;
    }
    merged.push(node);
  }
  return merged;
}

function migrateV2ToV3(v2: HomepageContentV2): HomepageContent {
  const content = reshapeAndMergeRows(v2.data.content as unknown as PuckNode[]);
  return { version: 3, data: { ...v2.data, content: content as unknown as Data["content"] } };
}

export async function getOrSeedHomepageContent(): Promise<HomepageContent> {
  const existing = await redis.get<StoredHomepageContent>(HOMEPAGE_CONTENT_KEY);

  if (existing?.version === 3) return existing;

  if (existing?.version === 2) {
    const migrated = migrateV2ToV3(existing);
    await redis.set(HOMEPAGE_CONTENT_KEY, migrated);
    return migrated;
  }

  if (existing?.version === 1) {
    const migrated = migrateV1ToV3(existing);
    await redis.set(HOMEPAGE_CONTENT_KEY, migrated);
    return migrated;
  }

  const legacyGrid = await getPromoGrid();
  const seeded = buildDefaultHomepageContent(legacyGrid);
  // Persisted immediately so this doesn't re-seed (and diverge) on every
  // request before the first real save — a rare concurrent double-seed from
  // two near-simultaneous first requests is harmless (same content either way).
  await redis.set(HOMEPAGE_CONTENT_KEY, seeded);
  return seeded;
}

export async function saveHomepageContent(data: Data): Promise<void> {
  const content: HomepageContent = { version: 3, data };
  await redis.set(HOMEPAGE_CONTENT_KEY, content);
}
