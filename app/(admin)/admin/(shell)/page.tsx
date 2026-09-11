import { auth } from "@/lib/server/auth-admin";
import { getAdminNewsletters } from "@/lib/domains/newsletters";
import { getBlacklistSource, getUserSubscriptionsAdmin } from "@/lib/domains/subscriptions";
import { BlacklistToggle } from "./BlacklistToggle";

// Port of AdminController::newsletterAdminAction — all newsletters + this
// admin's own subscription state (cache/DB three-way merge) + blacklist
// status. Per-user ActiveCampaign event history lives on /admin/users
// instead (see users/page.tsx) — that's where an admin is actually looking at
// a specific person's activity, not their own.
export default async function AdminDashboardPage() {
  const session = await auth();
  const email = session!.user!.email!;

  const [newsletters, subscriptions, blacklistSource] = await Promise.all([
    getAdminNewsletters(),
    getUserSubscriptionsAdmin(email),
    getBlacklistSource(email),
  ]);

  const subscriptionById = new Map(subscriptions.map((row) => [row.id, row]));

  return (
    <main className="page">
      <h1>Admin</h1>
      <p className="page-intro">{email}</p>

      <BlacklistToggle blacklistSource={blacklistSource} />

      <div className="section">
        <h2>Nyhedsbreve</h2>
        <ul>
          {newsletters.map((newsletter) => {
            const subscription = subscriptionById.get(newsletter.id);
            return (
              <li key={newsletter.id} className="admin-newsletter-row">
                <span>{newsletter.title}</span>
                <span className="admin-newsletter-row__badges">
                  <span className={`badge ${newsletter.published ? "badge--positive" : ""}`}>
                    {newsletter.published ? "Udgivet" : "Ikke udgivet"}
                  </span>
                  <span className={`badge ${subscription?.status === 1 ? "badge--positive" : ""}`}>
                    {subscription?.status === 1 ? "Tilmeldt" : "Ikke tilmeldt"}
                  </span>
                  {subscription?.cacheEvent && (
                    <span className="badge badge--neutral">cache: {subscription.cacheEvent}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
