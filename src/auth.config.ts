import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js configuration.
 *
 * This half contains NO database access, so it can run in the middleware (edge)
 * runtime. The Credentials provider and DB-backed callbacks live in ./auth.ts,
 * which only runs in Node contexts (route handlers, server components).
 */

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: Number(process.env.AUTH_SESSION_MAX_AGE ?? 3600),
  },
  providers: [],
  callbacks: {
    // Gatekeeper for the middleware: authenticated-or-redirect.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      const isPublic = PUBLIC_PATHS.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
      );

      if (isPublic) {
        // Bounce already-authenticated users away from the login page.
        if (isLoggedIn && pathname.startsWith("/login")) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      // Everything else requires a session.
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
