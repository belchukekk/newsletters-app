import { auth, signOut } from "@/lib/server/auth-admin";
import { AdminNav } from "./AdminNav";

// Sidebar shell for every /admin page except /admin/homepage (the Puck
// editor, which needs full-viewport space and lives outside this group).
// The auth redirect itself lives in the parent layout.tsx; this one only
// needs the session to display the signed-in email and the sign-out form.
export default async function AdminShellLayout({ children }: LayoutProps<"/admin">) {
  const session = await auth();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">Admin</div>
        <AdminNav />
        <div className="admin-sidebar__account">
          <span className="admin-sidebar__email">{session?.user?.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button className="admin-sidebar__signout" type="submit">
              Log ud
            </button>
          </form>
        </div>
      </aside>
      <div className="admin-shell__content">{children}</div>
    </div>
  );
}
