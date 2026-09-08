import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/lib/server/auth-admin";

// Defense in depth beyond proxy.ts's optimistic check — proxy only redirects
// unauthenticated requests, this re-verifies the session server-side too.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  return (
    <div>
      <div className="admin-bar">
        <nav className="admin-bar__nav">
          <Link href="/admin">Admin</Link>
          <Link href="/admin/newsletter-editor">Nyhedsbreve</Link>
          <Link href="/admin/promotions">Promoveringer</Link>
          <Link href="/admin/users">Brugere</Link>
          <Link href="/admin/gdpr">GDPR</Link>
        </nav>
        <div className="admin-bar__account">
          <span className="admin-bar__email">{session.user.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button className="admin-bar__signout" type="submit">
              Log ud
            </button>
          </form>
        </div>
      </div>
      {children}
    </div>
  );
}
