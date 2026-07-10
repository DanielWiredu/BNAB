import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { authConfig } from "./auth.config";
import {
  verifyIdentityPassword,
  needsRehash,
  hashIdentityPassword,
} from "@/server/auth/identity-hash";
import {
  findUserByEmail,
  getUserRoles,
  getSecurityStamp,
  updatePasswordHash,
} from "@/server/repositories/user-repository";
import { logger } from "@/lib/logger";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const STAMP_REVALIDATE_SECONDS = Number(
  process.env.AUTH_STAMP_REVALIDATE_SECONDS ?? 600,
);

function isLockedOut(user: {
  lockoutEnabled: boolean;
  lockoutEnd: Date | null;
}): boolean {
  if (!user.lockoutEnabled || !user.lockoutEnd) return false;
  return new Date(user.lockoutEnd).getTime() > Date.now();
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        try {
          const parsed = credentialsSchema.safeParse(raw);
          if (!parsed.success) {
            logger.warn("Login rejected: credentials failed shape validation");
            return null;
          }
          const { email, password } = parsed.data;

          const user = await findUserByEmail(email);
          if (!user) {
            logger.warn({ email }, "Login rejected: no user with that email");
            return null;
          }

          if (isLockedOut(user)) {
            logger.warn({ userId: user.id }, "Login rejected: account locked out");
            return null;
          }

          if (!verifyIdentityPassword(user.passwordHash, password)) {
            logger.warn({ userId: user.id }, "Login rejected: password mismatch");
            return null;
          }

          // Legacy requires a confirmed account (RequireConfirmedAccount = true).
          if (!user.emailConfirmed) {
            logger.warn({ userId: user.id }, "Login rejected: email not confirmed");
            return null;
          }

          // Transparently upgrade legacy V2 hashes to V3 (still legacy-readable).
          if (needsRehash(user.passwordHash)) {
            try {
              await updatePasswordHash(user.id, hashIdentityPassword(password));
            } catch (err) {
              logger.error({ err, userId: user.id }, "Password re-hash failed");
            }
          }

          const roles = await getUserRoles(user.id);
          logger.info({ userId: user.id, roles }, "Login success");

          return {
            id: user.id,
            email: user.email ?? undefined,
            name: user.name ?? user.userName ?? undefined,
            userKey: user.userKey ?? null,
            roles,
            securityStamp: user.securityStamp ?? null,
          };
        } catch (err) {
          // Surface the real cause — otherwise Auth.js masks it as a generic
          // failed login and the user just sees "invalid credentials".
          logger.error({ err }, "authorize() threw");
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      // Sign-in: seed the token from the authorized user.
      if (user) {
        token.userId = user.id as string;
        token.userKey = (user as { userKey?: string | null }).userKey ?? null;
        token.name = user.name ?? null;
        token.roles = (user as { roles?: string[] }).roles ?? [];
        token.securityStamp =
          (user as { securityStamp?: string | null }).securityStamp ?? null;
        token.stampCheckedAt = Math.floor(Date.now() / 1000);
        return token;
      }

      // Subsequent requests (Node only): throttled security-stamp revalidation.
      // Mirrors SecurityStampValidatorOptions.ValidationInterval — disabling a
      // user or changing their password kills live sessions within the window.
      const now = Math.floor(Date.now() / 1000);
      const lastChecked = (token.stampCheckedAt as number) ?? 0;
      if (token.userId && now - lastChecked >= STAMP_REVALIDATE_SECONDS) {
        try {
          const current = await getSecurityStamp(token.userId as string);
          if (current !== (token.securityStamp ?? null)) {
            // Stamp changed → invalidate the session.
            return null;
          }
          token.stampCheckedAt = now;
        } catch (err) {
          // On a transient DB error, don't nuke the session; re-check next time.
          logger.error({ err }, "Security-stamp revalidation failed");
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId as string) ?? "";
        session.user.userKey = (token.userKey as string | null) ?? null;
        session.user.name = (token.name as string | null) ?? null;
        session.user.roles = (token.roles as string[]) ?? [];
      }
      return session;
    },
  },
});
