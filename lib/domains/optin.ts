import { fetchBblByQuery, logToBbl } from "@/lib/integrations/bbl";
import {
  buildConfirmSubscriptionChecksum,
  buildUnsubscribeToken,
  verifyConfirmSubscriptionChecksum,
} from "@/lib/server/auth-magic-link";

// Port of MailChimpService::getOptinUrl — builds the /confirm-subscription
// link sent in the opt-in email (chk = md5(id+mail), verified by
// confirmSubscription below when the recipient clicks it).
export function buildOptInConfirmUrl(eventId: string, mail: string): string {
  const chk = buildConfirmSubscriptionChecksum(eventId, mail);
  return `https://nyhedsbreve.kristeligt-dagblad.dk/confirm-subscription?id=${eventId}&chk=${chk}`;
}

// Builds the one-click unsubscribe link shown in the opt-in email's FAQ
// ("fortryder du dine tilmelding") — lands on /newsletter-unsubscribe, which
// verifies the token and hands off to /unsubscribe for this newsletter.
export function buildNewsletterUnsubscribeUrl(email: string, newsletterId: string): string {
  const auth = buildUnsubscribeToken(email);
  return `https://nyhedsbreve.kristeligt-dagblad.dk/newsletter-unsubscribe?email=${encodeURIComponent(email)}&auth=${auth}&id=${encodeURIComponent(newsletterId)}`;
}

// Port of OptInService.php — confirms a pending opt-in ("permission") BBL
// event via the /confirm-subscription link sent by the opt-in email.

// BBL's API returns each hit with its fields flattened at the top level
// (_id, mail, lists, ref, ...) — NOT raw Elasticsearch's {_source: {...}}
// nesting. Confirmed directly from OptInService.php, which accesses
// $event['mail'] and $event['_id'] as siblings.
export type PendingOptInEvent = {
  _id: string;
  mail: string;
  lists?: string[];
  ref?: string;
  [key: string]: unknown;
};

async function findPendingOptInEvent(eventId: string): Promise<PendingOptInEvent | null> {
  const hits = await fetchBblByQuery({
    query: {
      constant_score: {
        filter: {
          bool: {
            must: [
              { terms: { _id: [eventId] } },
              { terms: { event: ["permission"] } },
              { exists: { field: "mail" } },
              { exists: { field: "lists" } },
            ],
          },
        },
      },
    },
    size: 1,
  });

  return (hits?.[0] as PendingOptInEvent | undefined) ?? null;
}

export type ConfirmSubscriptionResult =
  | { ok: true; event: PendingOptInEvent }
  | { ok: false };

// Port of OptInService::confirmSubscription — chk=md5(id+mail) is validated
// against the *found event's own* _id/mail fields, not the raw request
// params (the request only carries `id` and `chk`).
export async function confirmSubscription(
  eventId: string,
  chk: string
): Promise<ConfirmSubscriptionResult> {
  const event = await findPendingOptInEvent(eventId);
  if (!event) return { ok: false };
  if (!verifyConfirmSubscriptionChecksum(event._id, event.mail, chk)) {
    return { ok: false };
  }

  const { _id, ...entryWithoutId } = event;
  await logToBbl(
    { ...entryWithoutId, optin_confirmed: Math.floor(Date.now() / 1000) },
    (event.ref as string | undefined) || "/",
    `bigbucket/${_id}`
  );

  return { ok: true, event };
}
