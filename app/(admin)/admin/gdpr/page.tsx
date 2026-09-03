import { auth } from "@/lib/server/auth-admin";
import { getGdprOverview } from "@/lib/integrations/bigquery";
import { GdprEventsTable } from "./GdprEventsTable";

// Port of AdminController::gdprOverviewAction — GDPR event overview for the
// admin's own email (see PLAN.md's session-model note in subscriptions.ts:
// the old app's dual sessionEmail/sessionAdminEmail no longer exists, so the
// NextAuth session's own email stands in for it here).
export default async function GdprPage() {
  const session = await auth();
  const email = session!.user!.email!;
  const events = await getGdprOverview(email);

  return (
    <main>
      <h1>GDPR-oversigt</h1>
      <GdprEventsTable events={events} />
    </main>
  );
}
