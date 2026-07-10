import "server-only";

import { spAddAuditTrail } from "@/db/procedures";
import { getCurrentUser } from "@/server/auth/require-permission";
import { logger } from "@/lib/logger";

/**
 * Audit trail writer — mirrors the legacy pattern where every mutation calls
 * spAddAuditTrail(@actiondate, @actionby, @actiondescription, @actionid).
 * ActionBy is the user's key/identifier (ActionBy column is varchar(50)).
 */

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

export async function writeAuditTrail(input: {
  actionBy: string;
  description: string;
  actionId?: string | null;
}): Promise<void> {
  try {
    await spAddAuditTrail({
      actionDate: new Date(),
      actionBy: truncate(input.actionBy, 50),
      actionDescription: truncate(input.description, 100),
      actionId: input.actionId ? truncate(input.actionId, 50) : null,
    });
  } catch (err) {
    // Audit failures must never break the primary operation; log and continue.
    logger.error({ err, action: input.description }, "Audit trail write failed");
  }
}

/** Convenience: log an action attributed to the currently signed-in user. */
export async function logAction(
  description: string,
  actionId?: string | null,
): Promise<void> {
  const user = await getCurrentUser();
  const actionBy = user?.userKey || user?.name || user?.email || "system";
  await writeAuditTrail({ actionBy, description, actionId });
}
