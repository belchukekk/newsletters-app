"use server";

import { confirmSubscription } from "@/lib/domains/optin";
import { getPublishedNewsletters } from "@/lib/domains/newsletters";
import { createSession } from "@/lib/server/session";

export type ConfirmResult = { ok: true; newsletterTitle?: string } | { ok: false };

// Port of OptInService::confirmSubscription's controller-side glue —
// separated from the actual client-triggered confirm so a plain crawler GET
// on the link never triggers the side effect (the client component below
// calls this only after mounting/executing JS, matching the old app's
// anti-prefetch auto-submit form).
export async function confirmSubscriptionAction(
  id: string,
  chk: string
): Promise<ConfirmResult> {
  const result = await confirmSubscription(id, chk);
  if (!result.ok) return { ok: false };

  await createSession({ email: result.event.mail });

  const newsletterId = result.event.lists?.[0];
  const newsletters = await getPublishedNewsletters();
  const newsletter = newsletters.find((n) => n.id === newsletterId);

  return { ok: true, newsletterTitle: newsletter?.title };
}
