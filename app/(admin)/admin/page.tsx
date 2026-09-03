import Link from "next/link";

// Placeholder — the full dashboard (subscription state, blacklist, BigQuery
// event history) is phase 5. For now this just needs to exist so the auth
// gate has somewhere to land after sign-in.
export default function AdminDashboardPage() {
  return (
    <main>
      <h1>Admin</h1>
      <ul>
        <li>
          <Link href="/admin/newsletter-editor">Nyhedsbrev-redaktør</Link>
        </li>
      </ul>
    </main>
  );
}
