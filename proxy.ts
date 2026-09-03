// Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts` — same
// mechanics, see node_modules/next/dist/docs/01-app/03-file-conventions/proxy.md.
// Gates /admin/* on a valid NextAuth session; the `authorized` callback in
// auth-admin.ts decides the redirect. This is an optimistic check only — the
// admin Server Action and reorder Route Handler re-verify the session too.
export { auth as proxy } from "@/lib/server/auth-admin";

export const config = {
  matcher: ["/admin/:path*"],
};
