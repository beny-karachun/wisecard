import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe base config (no Prisma / bcrypt) — imported by middleware.
 * The Credentials provider with its DB lookup lives in `auth.ts`, which runs
 * on the Node runtime only.
 */
export const authConfig = {
  pages: {
    signIn: "/sign-in",
  },
  // Required for self-hosted production (next start / non-Vercel). Auth.js
  // only auto-trusts the host on Vercel or in dev.
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    // Gate /app/* behind authentication; everything else is public.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnApp = nextUrl.pathname.startsWith("/app");
      if (isOnApp) return isLoggedIn;
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
