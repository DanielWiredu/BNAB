import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge middleware: uses the DB-free config for authenticated-or-redirect gating.
// Fine-grained permission checks happen in server components / route handlers
// (see src/server/auth/require-permission.ts), not here.
export default NextAuth(authConfig).auth;

export const config = {
  // Run on everything except Next internals, the auth API, the CLMS inbound API
  // (which authenticates via shared secret), and static files.
  matcher: [
    "/((?!api/auth|api/clms|_next/static|_next/image|favicon.ico|images|plugins|.*\\.).*)",
  ],
};
