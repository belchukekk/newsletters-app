import Link from "next/link";
import { auth } from "@/lib/server/auth-admin";
import { getAdminNewsletters } from "@/lib/domains/newsletters";
import { getBlacklistSource, getUserSubscriptionsAdmin } from "@/lib/domains/subscriptions";
import { getEmailEventHistory } from "@/lib/integrations/bigquery";
import { BlacklistToggle } from "./BlacklistToggle";

// Port of AdminController::newsletterAdminAction — all newsletters + this
// admin's own subscription state (cache/DB three-way merge) + blacklist
// status, plus an optional BigQuery event-history panel behind ?events=1.
export default async function AdminDashboardPage(props: PageProps<"/admin">) {
  const session = await auth();
  const email = session!.user!.email!;
  const searchParams = await props.searchParams;
  const showEvents = searchParams.events === "1";

  const [newsletters, subscriptions, blacklistSource, events] = await Promise.all([
    getAdminNewsletters(),
    getUserSubscriptionsAdmin(email),
    getBlacklistSource(email),
    showEvents ? getEmailEventHistory(email) : Promise.resolve(null),
  ]);

  const subscriptionById = new Map(subscriptions.map((row) => [row.id, row]));

  return (
    <main className="page">
      <h1>Admin</h1>
      <p className="page-intro">{email}</p>

      <BlacklistToggle blacklistSource={blacklistSource} />

      <div className="section">
        <div className="page-nav">
          <Link href={showEvents ? "/admin" : "/admin?events=1"}>
            {showEvents ? "Skjul events" : "Vis events"}
          </Link>
        </div>

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

      {events && (
        <div className="section">
          <h2>Events</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dato</th>
                  <th>Liste</th>
                  <th>Kampagne</th>
                  <th>Event</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, index) => (
                  <tr key={index}>
                    <td>{event.timestamp}</td>
                    <td>{String(event.list ?? "")}</td>
                    <td>
                      <a href={event.url} target="_blank" rel="noreferrer">
                        {String(event.campaignName ?? "")}
                      </a>
                    </td>
                    <td>
                      <span
                        className={`badge ${event.eventType === "opened" ? "badge--positive" : ""}`}
                      >
                        {event.eventType}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
