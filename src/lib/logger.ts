import pino from "pino";

// Structured logging to stdout as JSON.
//
// NOTE: we deliberately do NOT use the `pino-pretty` transport. Pino transports
// run in a worker thread whose module resolution breaks under the Next.js dev/
// bundled server runtime, which would crash any module that imports the logger
// (e.g. the auth flow). Plain JSON logging is reliable everywhere.
export const logger = pino({
  level:
    process.env.LOG_LEVEL ??
    (process.env.NODE_ENV === "production" ? "info" : "debug"),
});
