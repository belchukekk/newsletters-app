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
      <header>
        <nav>
          <Link href="/admin">Admin</Link>
          <Link href="/admin/newsletter-editor">Nyhedsbreve</Link>
        </nav>
        <span>{session.user.email}</span>
        <form
          action={async () => {
            "use server";
            await signOut();
          }}
        >
          <button type="submit">Log ud</button>
        </form>
      </header>
      <main>{children}</main>
    </div>
  );
}
