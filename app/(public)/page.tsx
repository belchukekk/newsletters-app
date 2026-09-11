import { Render, resolveAllData, walkTree, type Config, type Data } from "@puckeditor/core";
import { getPublishedNewsletters } from "@/lib/domains/newsletters";
import { getOrSeedHomepageContent } from "@/lib/domains/homepage";
import { getUserSubscriptions } from "@/lib/domains/subscriptions";
import { UTM_NEWSLETTER_PARAM } from "@/lib/domains/promotions";
import { getSession } from "@/lib/server/session";
import { buildPuckConfig } from "@/lib/puck/config";
import type { HomepageMetadata } from "@/lib/puck/components/Newsletter";
import { resolvePromotion } from "@/lib/puck/components/Promotion";
import type { PromotionValue } from "@/lib/puck/fields/PromotionField";

// Replaces the old static full-list frontpage with a Puck-authored page
// (see /admin/homepage): a freely-composed hero plus individual Newsletter
// components arranged in Row components, and any number of Promotion
// components. A grid Newsletter card only ever defers when a Promotion
// elsewhere on the page is actively showing the same newsletter — a
// viewer's subscription status never excludes a grid card by itself;
// "show another newsletter if subscribed" is a Promotion-only behavior
// (see lib/puck/components/Promotion.tsx's resolvePromotion).
//
// ?utm_campaign=<value> no longer promotes a newsletter to the top of the
// page the way the old single-grid design did — instead, any Promotion
// component on the page can be configured with its own UTM-keyed variants
// (see lib/puck/components/Promotion.tsx), each swapping in a different
// newsletter/copy/image for that campaign, falling back to its default when
// nothing matches. When a variant IS active, its displaced default newsletter
// switches places with it — see collectPromotionEffects below.
export default async function HomePage(props: PageProps<"/">) {
  const searchParams = await props.searchParams;
  const utmParam = searchParams[UTM_NEWSLETTER_PARAM];
  const utmCampaign = Array.isArray(utmParam) ? (utmParam[0] ?? null) : (utmParam ?? null);

  const [content, newsletters, session] = await Promise.all([
    getOrSeedHomepageContent(),
    getPublishedNewsletters(),
    getSession(),
  ]);

  const subscribedIds = session?.email ? await getUserSubscriptions(session.email) : [];
  const config = buildPuckConfig({ newsletters });

  // A first pass, ahead of the real resolveAllData call below: figure out
  // which newsletter every Promotion component on the page is ACTUALLY
  // showing right now (nominal entry, or its own subscription-fallback —
  // see resolvePromotion), and — when a UTM variant is active — which
  // default newsletter it displaced, so a plain Newsletter card elsewhere
  // can either defer to it or show the displaced default in its place.
  const { promotedNewsletterIds, swapReplacements } = collectPromotionEffects(
    content.data,
    config,
    utmCampaign,
    subscribedIds
  );

  const metadata: HomepageMetadata = {
    newsletters,
    viewerEmail: session?.email ?? null,
    subscribedIds,
    utmCampaign,
    promotedNewsletterIds,
    swapReplacements,
  };
  const resolved = await resolveAllData(content.data, config, metadata);

  return (
    <main className="page">
      {session?.email && (
        <p className="page-intro">
          Du er logget ind som <strong>{session.email}</strong>.
        </p>
      )}
      <Render config={config} data={resolved} />
    </main>
  );
}

function collectPromotionEffects(
  data: Data,
  config: Config,
  utmCampaign: string | null,
  subscribedIds: string[]
): { promotedNewsletterIds: string[]; swapReplacements: Record<string, string> } {
  const promotedIds = new Set<string>();
  const swapReplacements: Record<string, string> = {};

  walkTree(data, config, (nodes) => {
    for (const node of nodes) {
      if (node.type === "Promotion") {
        const promotionConfig = (node.props as unknown as { config: PromotionValue }).config;
        const { displayedEntry, displacedNewsletterId } = resolvePromotion(promotionConfig, utmCampaign, subscribedIds);
        const activeId = displayedEntry.newsletterId;
        if (activeId) promotedIds.add(activeId);
        if (displacedNewsletterId && displacedNewsletterId !== activeId) {
          swapReplacements[activeId] = displacedNewsletterId;
        }
      }
    }
  });

  return { promotedNewsletterIds: Array.from(promotedIds), swapReplacements };
}
