import Link from "next/link";
import { getPublishedNewsletters } from "@/lib/domains/newsletters";
import {
  getPromoGrid,
  resolvePromoGridForViewer,
  UTM_NEWSLETTER_PARAM,
  type ResolvedPromoSlot,
} from "@/lib/domains/promotions";
import { getSession } from "@/lib/server/session";
import { NewsletterSubscribeToggle } from "./_components/NewsletterSubscribeToggle";

function SlotCard({
  slot,
  isLoggedIn,
  subscribed,
}: {
  slot: ResolvedPromoSlot;
  isLoggedIn: boolean;
  subscribed: boolean;
}) {
  return (
    <li className="newsletter-card">
      {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail/promo image hosts vary (local default, S3 newsletter thumbnail, or S3 promo override), not worth a remotePatterns config */}
      <img className="newsletter-card__media" src={slot.imageUrl} alt="" width={72} height={72} />
      <div className="newsletter-card__body">
        <h2 className="newsletter-card__title">{slot.newsletter.title}</h2>
        <p className="newsletter-card__description">{slot.newsletter.description}</p>
        {isLoggedIn ? (
          <NewsletterSubscribeToggle
            newsletterId={slot.newsletter.id}
            newsletterTitle={slot.newsletter.title}
            initialSubscribed={subscribed}
          />
        ) : (
          <Link className="newsletter-card__link" href={`/subscribe?id=${slot.newsletter.id}`}>
            Tilmeld
          </Link>
        )}
      </div>
    </li>
  );
}

// Replaces the old static full-list frontpage with a marketing-configurable
// promo grid (see /admin/newsletters) — rows of 1-4 slots, each promoting one
// newsletter, swapped for a fallback promotion when the viewer is already
// subscribed to the primary one. A marketing link's UTM tag
// (?utm_campaign=<newsletter-id>) promotes that newsletter to a full-width
// row at the top; when that's active, the rest of the grid renders as a
// uniform 2-column layout (ignoring each row's own configured column count)
// so it's visually clear which newsletter is the one actually being promoted.
//
// A logged-in viewer (session cookie already set — whether via the /auth
// magic link they clicked, or one silently triggered in the background by
// the Drupal site for an already-logged-in visitor) sees an inline toggle
// per newsletter instead of a "Tilmeld" link, same as /manage.
export default async function HomePage(props: PageProps<"/">) {
  const searchParams = await props.searchParams;
  const utmParam = searchParams[UTM_NEWSLETTER_PARAM];
  const utmNewsletterId = Array.isArray(utmParam) ? utmParam[0] : (utmParam ?? null);

  const [newsletters, grid, session] = await Promise.all([
    getPublishedNewsletters(),
    getPromoGrid(),
    getSession(),
  ]);

  const { promotedSlot, rows, subscribedIds } = await resolvePromoGridForViewer(
    grid,
    newsletters,
    session?.email ?? null,
    utmNewsletterId
  );

  const isPromoted = promotedSlot !== null;
  const isLoggedIn = session !== null;

  function renderSlot(slot: ResolvedPromoSlot) {
    return (
      <SlotCard
        key={slot.id}
        slot={slot}
        isLoggedIn={isLoggedIn}
        subscribed={subscribedIds.includes(slot.newsletter.id)}
      />
    );
  }

  return (
    <main className="page">
      <h1>Nyhedsbreve fra Kristeligt Dagblad</h1>
      <p className="page-intro">
        Vælg de nyhedsbreve, du vil modtage, og hold dig opdateret med det, der
        betyder noget for dig.
      </p>

      {promotedSlot && (
        <ul className="promo-row promo-row--cols-1">{renderSlot(promotedSlot)}</ul>
      )}

      {rows.length === 0 && !promotedSlot ? (
        <p className="notice notice--info">Der er ikke konfigureret nogen nyhedsbreve endnu.</p>
      ) : isPromoted ? (
        rows.length > 0 && (
          <ul className="promo-row promo-row--cols-2">
            {rows.flatMap((row) => row.slots).map(renderSlot)}
          </ul>
        )
      ) : (
        rows.map((row) => (
          // A slot can drop out for this viewer (already subscribed to
          // everything it could show — see resolvePromoGridForViewer), so
          // the effective column count reflects what's actually left rather
          // than leaving a blank gap where the configured column count says
          // there should be more.
          <ul
            key={row.id}
            className={`promo-row promo-row--cols-${Math.min(row.columns, row.slots.length)}`}
          >
            {row.slots.map(renderSlot)}
          </ul>
        ))
      )}
    </main>
  );
}
