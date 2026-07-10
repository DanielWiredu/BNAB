import "server-only";

import { query, sql } from "@/db/mssql";
import {
  listUsers,
  listRoles,
  findUserById,
  getUserRoles,
} from "@/server/repositories/user-repository";
import { getPermissionStatus } from "@/server/auth/permission-service";
import { getClmsQueue, getEmailQueue } from "@/jobs/queues";

// ── Users ────────────────────────────────────────────────────────────────────

export { listUsers, listRoles };

export interface UserDetail {
  id: string;
  email: string | null;
  name: string | null;
  userKey: string | null;
  roles: string[];
  status: Record<string, { isEffective: boolean; source: string }>;
}

/** Full detail for the user permission panel, or null if the user is missing. */
export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const user = await findUserById(userId);
  if (!user) return null;
  const [roles, status] = await Promise.all([
    getUserRoles(userId),
    getPermissionStatus(userId),
  ]);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    userKey: user.userKey,
    roles,
    status,
  };
}

// ── Audit trail ──────────────────────────────────────────────────────────────

export interface AuditRow {
  actionId: string | null;
  actionBy: string | null;
  actionDescription: string | null;
  actionDate: Date;
}

/** Top 1000 audit-trail rows (User Name resolved from AspNetUsers), searchable. */
export async function searchAuditTrail(search = ""): Promise<AuditRow[]> {
  return query<AuditRow>(
    `SELECT TOP(1000)
            a.[ActionID]          AS actionId,
            ISNULL(u.[Name], a.[ActionBy]) AS actionBy,
            a.[ActionDescription] AS actionDescription,
            a.[ActionDate]        AS actionDate
       FROM [tblAuditTrail] a
       LEFT JOIN [AspNetUsers] u ON u.[Id] = a.[ActionBy]
      WHERE (a.[ActionID] LIKE '%' + @s + '%'
             OR ISNULL(u.[Name], a.[ActionBy]) LIKE '%' + @s + '%'
             OR a.[ActionDescription] LIKE '%' + @s + '%')
      ORDER BY a.[ActionDate] DESC`,
    [{ name: "s", type: sql.NVarChar(256), value: search }],
  );
}

// ── Background jobs (BullMQ) ─────────────────────────────────────────────────

export interface FailedJob {
  id: string;
  name: string;
  reason: string;
  attemptsMade: number;
  failedAt: number | null;
}

export interface QueueStats {
  key: "clms" | "email";
  name: string;
  counts: Record<string, number>;
  failed: FailedJob[];
}

export interface JobsSnapshot {
  available: boolean;
  error?: string;
  queues: QueueStats[];
}

async function statsFor(key: "clms" | "email"): Promise<QueueStats> {
  const queue = key === "clms" ? getClmsQueue() : getEmailQueue();
  const counts = await queue.getJobCounts(
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed",
    "paused",
  );
  const failedJobs = await queue.getJobs(["failed"], 0, 24);
  const failed: FailedJob[] = failedJobs.map((j) => ({
    id: String(j.id ?? ""),
    name: j.name,
    reason: j.failedReason ?? "",
    attemptsMade: j.attemptsMade,
    failedAt: j.finishedOn ?? null,
  }));
  return { key, name: queue.name, counts, failed };
}

/** Queue counts + recent failed jobs. Degrades gracefully when Redis is down. */
export async function getJobsSnapshot(): Promise<JobsSnapshot> {
  try {
    const queues = await Promise.all([statsFor("clms"), statsFor("email")]);
    return { available: true, queues };
  } catch (err) {
    return {
      available: false,
      error: err instanceof Error ? err.message : "Redis is unavailable.",
      queues: [],
    };
  }
}
