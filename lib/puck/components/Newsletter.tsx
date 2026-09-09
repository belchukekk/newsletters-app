import type { ComponentConfig } from "@puckeditor/core";
import type { Newsletter as NewsletterRecord } from "@/lib/domains/newsletters";
import { NewsletterSubscribeToggle } from "@/app/(public)/_components/NewsletterSubscribeToggle";
import { NewsletterEntryField, type NewsletterEntryValue } from "@/lib/puck/fields/NewsletterEntryField";

export type HomepageMetadata = {
  newsletters: NewsletterRecord[];
  viewerEmail: string | null;
  subscribedIds: string[];
  // ?utm_campaign=<value> from the current request — see the Promotion
  // component (lib/puck/components/Promotion.tsx), which is the only
  // consumer of this.
  utmCampaign: string | null;
  // Ids every Promotion component on the page currently resolves to (default
  // or UTM-matched, computed by app/(public)/page.tsx in a first pass before
  // the real resolveAllData call — see resolvePromotion). A Newsletter card
  // whose own newsletterId shows up here defers below — a newsletter being
  // actively promoted elsewhere on the page shouldn't also show up in its
  // normal grid position. This is the ONLY thing that makes a grid card
  // defer to its fallback (or drop) — a viewer's subscription status never
  // does; "show another newsletter if subscribed" is a Promotion-only
  // behavior (see Promotion.tsx's resolvePromotion).
  promotedNewsletterIds: string[];
  // Whenever a Promotion component ends up showing something other than its
  // plain default — a UTM variant took over, or its own subscription
  // fallback kicked in — maps the now-displayed newsletter id -> whichever
  // one got bumped out to make room for it. A Newsletter card that would
  // have shown the now-displayed newsletter shows the bumped one in its
  // place instead of just disappearing: the two "switch places". Checked
  // before falling back to this card's own manually-configured fallback.
  swapReplacements: Record<string, string>;
};

type ResolvedEntry = { newsletter: NewsletterRecord; imageUrl: string } | null;

type NewsletterProps = {
  entry: NewsletterEntryValue;
  __resolved?: ResolvedEntry;
  __isLoggedIn?: boolean;
  __subscribed?: boolean;
};

// One promoted newsletter — the "each newsletter is its own component" half
// of the old single NewsletterGrid, dropped into a Row's column slots.
// resolveData only ever reads plain arrays off `metadata` (never a DB call
// itself) — see app/(public)/page.tsx, which computes subscribedIds once,
// server-side, and passes it in. That's deliberate: this file (and its
// import graph) is shared with the client editor config, so it must never
// value-import anything that touches the database.
export function buildNewsletterComponent({
  newsletters,
  onNewsletterPatched,
}: {
  newsletters: NewsletterRecord[];
  onNewsletterPatched: (id: string, patch: { title: string; description: string; imageUrl: string; published: boolean }) => void;
}): ComponentConfig<NewsletterProps> {
  return {
    label: "Nyhedsbrev",
    fields: {
      entry: {
        type: "custom",
        render: (fieldProps) => (
          <NewsletterEntryField
            {...fieldProps}
            newsletters={newsletters}
            onNewsletterPatched={onNewsletterPatched}
          />
        ),
      },
    },
    defaultProps: { entry: { newsletterId: newsletters[0]?.id ?? "" } },
    resolveData: async ({ props }: { props: NewsletterProps }, { metadata }: { metadata?: Partial<HomepageMetadata> }) => {
      if (!metadata?.newsletters) return { props };

      const newslettersById = new Map(metadata.newsletters.map((n) => [n.id, n]));
      const subscribedIds = metadata.subscribedIds ?? [];
      const promotedNewsletterIds = metadata.promotedNewsletterIds ?? [];
      const swapReplacements = metadata.swapReplacements ?? {};
      const entry = props.entry;

      // The only reason a grid card defers below — a Promotion component
      // elsewhere on the page is already showing this newsletter. Subscribed
      // status never excludes a newsletter here; that's Promotion-only.
      const isPromotedElsewhere = (newsletterId: string) => promotedNewsletterIds.includes(newsletterId);

      let resolved: ResolvedEntry = null;
      if (!isPromotedElsewhere(entry.newsletterId)) {
        const newsletter = newslettersById.get(entry.newsletterId);
        if (newsletter) {
          resolved = { newsletter, imageUrl: entry.customImageUrl || newsletter.imageUrl };
        }
      } else {
        // A UTM-triggered promotion swap takes priority over this slot's own
        // manually-configured fallback — it's the more specific, deliberate
        // "these two switch places" intent.
        const swapId = swapReplacements[entry.newsletterId];
        if (swapId && !isPromotedElsewhere(swapId)) {
          const newsletter = newslettersById.get(swapId);
          if (newsletter) {
            resolved = { newsletter, imageUrl: newsletter.imageUrl };
          }
        } else if (entry.fallback && !isPromotedElsewhere(entry.fallback.newsletterId)) {
          const newsletter = newslettersById.get(entry.fallback.newsletterId);
          if (newsletter) {
            resolved = { newsletter, imageUrl: entry.fallback.customImageUrl || newsletter.imageUrl };
          }
        }
      }

      return {
        props: {
          ...props,
          __resolved: resolved,
          __isLoggedIn: (metadata.viewerEmail ?? null) !== null,
          __subscribed: resolved ? subscribedIds.includes(resolved.newsletter.id) : false,
        },
      };
    },
    render: ({ entry, __resolved, __isLoggedIn, __subscribed }) => {
      // No metadata at all (the editor canvas, see HomepageEditor.tsx never
      // passing one to <Puck>) — a static, unpersonalized preview.
      if (__resolved === undefined) {
        const newsletter = newsletters.find((n) => n.id === entry.newsletterId);
        return (
          <div className="newsletter-card">
            {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail hosts vary (local default vs S3), not worth a remotePatterns config */}
            <img
              className="newsletter-card__media"
              src={entry.customImageUrl || newsletter?.imageUrl || "/assets/img/newsletter/default.jpg"}
              alt=""
            />
            <div className="newsletter-card__body">
              <h3 className="newsletter-card__title">{newsletter?.title ?? "Vælg et nyhedsbrev"}</h3>
              <p className="newsletter-card__description">{newsletter?.description}</p>
            </div>
          </div>
        );
      }

      // Real page, but this viewer is already subscribed to everything this
      // entry could offer (primary, and fallback too if configured) —
      // nothing worth showing. Puck's render type requires an element, not
      // null, hence the empty fragment.
      if (__resolved === null) return <></>;

      return (
        <div className="newsletter-card">
          {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail/promo image hosts vary (local default, S3 newsletter thumbnail, or S3 promo override), not worth a remotePatterns config */}
          <img className="newsletter-card__media" src={__resolved.imageUrl} alt="" />
          <div className="newsletter-card__body">
            <h3 className="newsletter-card__title">{__resolved.newsletter.title}</h3>
            <p className="newsletter-card__description">{__resolved.newsletter.description}</p>
            {__isLoggedIn ? (
              <NewsletterSubscribeToggle
                newsletterId={__resolved.newsletter.id}
                newsletterTitle={__resolved.newsletter.title}
                initialSubscribed={!!__subscribed}
              />
            ) : (
              <a className="newsletter-card__link" href={`/subscribe?id=${__resolved.newsletter.id}`}>
                Tilmeld
              </a>
            )}
          </div>
        </div>
      );
    },
  };
}
