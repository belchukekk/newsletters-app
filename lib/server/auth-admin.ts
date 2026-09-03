import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Admins sign in with a company Google account — restricted to whatever
// domain ADMIN_EMAIL_DOMAIN names (see PLAN.md's admin-auth decision). This
// replaces the old app's md5-signed "admin" magic-link variant entirely.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    signIn({ user }) {
      const domain = process.env.ADMIN_EMAIL_DOMAIN;
      if (!domain) return false;
      return user.email?.toLowerCase().endsWith(`@${domain.toLowerCase()}`) ?? false;
    },
    // Used by proxy.ts to gate /admin/*: a falsy return triggers NextAuth's
    // own redirect to the sign-in page.
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
});
