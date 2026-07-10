import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      userKey: string | null;
      roles: string[];
    } & DefaultSession["user"];
  }

  interface User {
    userKey?: string | null;
    roles?: string[];
    securityStamp?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    userKey?: string | null;
    roles?: string[];
    securityStamp?: string | null;
    stampCheckedAt?: number;
  }
}
