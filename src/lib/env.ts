import { config } from "dotenv";
import { expand } from "dotenv-expand";

/**
 * Load .env with variable expansion — matching how Next.js loads env at runtime
 * (Next uses dotenv-expand). Importing this in standalone scripts (seed, checks,
 * worker) ensures they interpret escaped values (e.g. `\$` → `$`) identically to
 * the app, so a password containing `$` isn't mangled differently in each place.
 */
expand(config());
