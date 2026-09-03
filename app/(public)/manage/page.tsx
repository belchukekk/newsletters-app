import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/session";
import { getPublishedNewsletters } from "@/lib/domains/newsletters";
import { getUserSubscriptions } from "@/lib/domains/subscriptions";
import { SubscriptionToggleList } from "../_components/SubscriptionToggleList";

// Port of Controller::manageAction — the logged-in user's own subscription
// management page.
export default async function ManagePage() {
  const session = await getSession();
  if (!session) redirect("/");

  const [newsletters, subscribedIds] = await Promise.all([
    getPublishedNewsletters(),
    getUserSubscriptions(session.email),
  ]);

  return (
    <main>
      {session.originLink && (
        <a href={session.originLink}>« {session.originLabel}</a>
      )}
      <h1>Mine nyhedsbreve</h1>
      <SubscriptionToggleList newsletters={newsletters} subscribedIds={subscribedIds} />
    </main>
  );
}
