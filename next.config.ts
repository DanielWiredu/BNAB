import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output bundles a minimal server + node_modules into
  // .next/standalone, which is the simplest artifact to run as a Windows
  // Service behind IIS (reverse proxy). See docs/DEPLOYMENT.md.
  output: "standalone",
  // Pin the workspace root to this project so a stray lockfile elsewhere
  // (e.g. in the user's home dir) doesn't get inferred as the root.
  outputFileTracingRoot: process.cwd(),
  // mssql / tedious and pino are server-only native-ish deps; keep them external
  // so Next doesn't try to bundle them into serverless/edge output.
  // bullmq / ioredis / nodemailer are used by the CLMS reconcile + email queue
  // (Phase 4) and must not be bundled into the edge/serverless output either.
  serverExternalPackages: [
    "mssql",
    "@prisma/client",
    "pino",
    "bullmq",
    "ioredis",
    "nodemailer",
    // exceljs (Phase 8 report exports) bundles native-ish stream deps; keep it
    // external so it isn't pulled into the edge/serverless output.
    "exceljs",
  ],
  eslint: {
    // Lint is run explicitly via `npm run lint`; don't block builds during migration.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
