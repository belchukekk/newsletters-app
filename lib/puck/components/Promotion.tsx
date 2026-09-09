import type { ComponentConfig } from "@puckeditor/core";
import type { Newsletter as NewsletterRecord } from "@/lib/domains/newsletters";
import { NewsletterSubscribeToggle } from "@/app/(public)/_components/NewsletterSubscribeToggle";
import {
  PromotionField,
  DEFAULT_PROMOTION_BACKGROUND,
  type PromotionValue,
  type PromotionEntry,
  type PromotionEntryBase,
} from "@/lib/puck/fields/PromotionField";
import type { HomepageMetadata } from "@/lib/puck/components/Newsletter";

type Resolved = { newsletter: NewsletterRecord; imageUrl: string; entry: PromotionEntryBase } | null;

type PromotionProps = {
  config: PromotionValue;
  __resolved?: Resolved;
  __isLoggedIn?: boolean;
  __subscribed?: boolean;
};

function matchVariant(config: PromotionValue, utmCampaign: string | null) {
  return utmCampaign ? config.variants.find((variant) => variant.utmValue === utmCampaign) : undefined;
}

export type PromotionResolution = {
  // The entry actually shown: the nominal one (default, or the UTM-matched
  // variant), or its fallback when the viewer is already subscribed to the
  // nominal newsletter and a valid fallback is configured. "Show another
  // newsletter if subscribed" lives only here — not on plain grid Newsletter
  // cards, see Newsletter.tsx.
  displayedEntry: PromotionEntryBase;
  // Whichever newsletter got bumped OUT of view to produce displayedEntry —
  // either the default (bumped by an active UTM variant) or the nominal
  // entry itself (bumped by its own subscription-fallback) — so it can
  // "switch places" with displayedEntry wherever a plain Newsletter card
  // elsewhere shows it (see Newsletter.tsx's swapReplacements). Null when
  // nothing was displaced (displayedEntry is just config.default, shown
  // as-is).
  displacedNewsletterId: string | null;
};

// Pure (no DB, no metadata beyond what's passed in) so it can run twice: once
// here in resolveData, and once more in app/(public)/page.tsx's first pass
// over the whole tree, which needs to know — before resolving any Newsletter
// component — which newsletter every Promotion on the page is ACTUALLY
// showing (i.e. post subscription-fallback too), so a matching Newsletter
// card elsewhere can defer to it (see Newsletter.tsx's promotedNewsletterIds
// and swapReplacements).
export function resolvePromotion(
  config: PromotionValue,
  utmCampaign: string | null,
  subscribedIds: string[]
): PromotionResolution {
  const matched = matchVariant(config, utmCampaign);
  // What would show if we ignored the viewer's subscriptions entirely.
  const nominalEntry: PromotionEntry = matched?.entry ?? config.default;

  const subscriptionSwapped =
    subscribedIds.includes(nominalEntry.newsletterId) &&
    !!nominalEntry.fallback &&
    !subscribedIds.includes(nominalEntry.fallback.newsletterId);

  if (subscriptionSwapped) {
    // The subscription fallback took over from nominalEntry — that's what
    // needs to switch places elsewhere on the page, regardless of whether a
    // UTM variant was also involved in getting to nominalEntry.
    return { displayedEntry: nominalEntry.fallback!, displacedNewsletterId: nominalEntry.newsletterId };
  }

  const displacedByUtm = matched && nominalEntry.newsletterId !== config.default.newsletterId;
  return {
    displayedEntry: nominalEntry,
    displacedNewsletterId: displacedByUtm ? config.default.newsletterId : null,
  };
}

// A single large, featured promotion — unlike the compact Newsletter card,
// this picks between a default newsletter and any number of UTM-tagged
// variants (e.g. ?utm_campaign=paaske promotes a different newsletter, with
// its own copy/image, than the default) based on the current request. Falls
// back to the default whenever there's no UTM tag, or none of the
// configured variants match it. Each entry can also declare its own
// subscription-based fallback (see resolvePromotion) — if the viewer's
// already subscribed to the newsletter it would otherwise show.
export function buildPromotionComponent({
  newsletters,
  onNewsletterPatched,
}: {
  newsletters: NewsletterRecord[];
  onNewsletterPatched: (id: string, patch: { title: string; description: string; imageUrl: string; published: boolean }) => void;
}): ComponentConfig<PromotionProps> {
  return {
    label: "Promovering",
    fields: {
      config: {
        type: "custom",
        render: (fieldProps) => (
          <PromotionField {...fieldProps} newsletters={newsletters} onNewsletterPatched={onNewsletterPatched} />
        ),
      },
    },
    defaultProps: {
      config: { default: { newsletterId: newsletters[0]?.id ?? "" }, variants: [] },
    },
    resolveData: async ({ props }: { props: PromotionProps }, { metadata }: { metadata?: Partial<HomepageMetadata> }) => {
      if (!metadata?.newsletters) return { props };

      const newslettersById = new Map(metadata.newsletters.map((n) => [n.id, n]));
      const subscribedIds = metadata.subscribedIds ?? [];
      const utmCampaign = metadata.utmCampaign ?? null;

      const { displayedEntry } = resolvePromotion(props.config, utmCampaign, subscribedIds);

      const newsletter = newslettersById.get(displayedEntry.newsletterId);
      const resolved: Resolved = newsletter
        ? { newsletter, imageUrl: displayedEntry.customImageUrl || newsletter.imageUrl, entry: displayedEntry }
        : null;

      return {
        props: {
          ...props,
          __resolved: resolved,
          __isLoggedIn: (metadata.viewerEmail ?? null) !== null,
          __subscribed: resolved ? subscribedIds.includes(resolved.newsletter.id) : false,
        },
      };
    },
    render: ({ config, __resolved, __isLoggedIn, __subscribed }) => {
      // Editor canvas (no metadata) — always preview the nominal default
      // entry; there's no real viewer to check a subscription-fallback
      // against.
      if (__resolved === undefined) {
        const newsletter = newsletters.find((n) => n.id === config.default.newsletterId);
        return (
          <PromotionCard
            entry={config.default}
            title={newsletter?.title ?? "Vælg et nyhedsbrev"}
            description={newsletter?.description ?? ""}
            imageUrl={config.default.customImageUrl || newsletter?.imageUrl || "/assets/img/newsletter/default.jpg"}
            cta={
              <a className="newsletter-card__link" href="#">
                Tilmeld
              </a>
            }
          />
        );
      }

      if (__resolved === null) return <></>;

      const cta = __isLoggedIn ? (
        <NewsletterSubscribeToggle
          newsletterId={__resolved.newsletter.id}
          newsletterTitle={__resolved.newsletter.title}
          initialSubscribed={!!__subscribed}
        />
      ) : (
        <a className="newsletter-card__link" href={`/subscribe?id=${__resolved.newsletter.id}`}>
          Tilmeld
        </a>
      );

      return (
        <PromotionCard
          entry={__resolved.entry}
          title={__resolved.newsletter.title}
          description={__resolved.newsletter.description}
          imageUrl={__resolved.imageUrl}
          cta={cta}
        />
      );
    },
  };
}

// The large, two-column feature layout — an original, simplified take on a
// marketing reference (eyebrow/title/tagline/CTA on one side, an image on
// the other), not a pixel clone of any specific illustration.
// backgroundColor/fullWidth live on the entry itself (see PromotionField) —
// each UTM variant (and the default, and any subscription fallback) can
// look different, not just have different copy/newsletter. fullWidth breaks
// the background out to the viewport edges while keeping the text/image
// content itself at the page's normal reading width.
function PromotionCard({
  entry,
  title,
  description,
  imageUrl,
  cta,
}: {
  entry: PromotionEntryBase;
  title: string;
  description: string;
  imageUrl: string;
  cta: React.ReactNode;
}) {
  const backgroundColor = entry.backgroundColor ?? DEFAULT_PROMOTION_BACKGROUND;
  const fullWidth = !!entry.fullWidth;

  const card = (
    <div className="promo-feature">
      <div className="promo-feature__text" style={{ backgroundColor }}>
        <p className="promo-feature__eyebrow">Nyhedsbrev</p>
        <h3 className="promo-feature__title">{title}</h3>
        <p className="promo-feature__tagline">{description}</p>
        <div className="promo-feature__cta">{cta}</div>
      </div>
      <div className="promo-feature__media">
        {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail/promo image hosts vary (local default, S3 newsletter thumbnail, or S3 promo override), not worth a remotePatterns config */}
        <img className="promo-feature__image" src={imageUrl} alt="" />
      </div>
    </div>
  );

  if (!fullWidth) return card;

  return (
    <div className="promo-feature-bleed" style={{ backgroundColor }}>
      <div className="promo-feature-bleed__inner">{card}</div>
    </div>
  );
}
