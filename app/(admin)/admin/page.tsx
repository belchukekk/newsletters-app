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
    <main>
      <h1>Admin</h1>
      <p>{email}</p>

      <BlacklistToggle blacklistSource={blacklistSource} />

      <nav>
        <Link href="/admin/newsletter-editor">Nyhedsbrev-redaktør</Link>{" "}
        <Link href="/admin/gdpr">GDPR</Link>{" "}
        <Link href={showEvents ? "/admin" : "/admin?events=1"}>
          {showEvents ? "Skjul events" : "Vis events"}
        </Link>
      </nav>

      <h2>Nyhedsbreve</h2>
      <ul>
        {newsletters.map((newsletter) => {
          const subscription = subscriptionById.get(newsletter.id);
          return (
            <li key={newsletter.id}>
              {newsletter.title} — {newsletter.published ? "udgivet" : "ikke udgivet"} —{" "}
              {subscription?.status === 1 ? "tilmeldt" : "ikke tilmeldt"}
              {subscription?.cacheEvent && <em> (cache: {subscription.cacheEvent})</em>}
            </li>
          );
        })}
      </ul>

      {events && (
        <>
          <h2>Events</h2>
          <table>
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
                  <td>{event.eventType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
