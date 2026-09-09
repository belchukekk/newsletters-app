import { redirect } from "next/navigation";
import { auth } from "@/lib/server/auth-admin";

// Defense in depth beyond proxy.ts's optimistic check — proxy only redirects
// unauthenticated requests, this re-verifies the session server-side too.
// Auth-only: the sidebar shell lives in (shell)/layout.tsx so that
// /admin/homepage can render full-viewport without it.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  return children;
}
