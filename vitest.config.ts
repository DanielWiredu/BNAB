import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Pin a non-UTC, non-integer-offset zone WEST of UTC. The calendar-date
    // bugs src/lib/date.ts guards against are invisible at UTC+0 (which is
    // Ghana, and which is why they shipped) — running the suite at UTC would
    // make src/lib/date.test.ts pass no matter how the code regressed.
    env: { TZ: "America/St_Johns" },
  },
});
