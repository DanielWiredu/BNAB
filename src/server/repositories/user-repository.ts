import { randomUUID } from "node:crypto";

import { query, sql } from "@/db/mssql";

/**
 * Authentication data access over the ASP.NET Identity tables.
 *
 * Uses node-mssql directly (not Prisma) so login works before `prisma db pull`
 * has been run, and so we're insulated from how introspection names the models.
 * These tables are READ mostly; the only writes are transparent password
 * re-hashes and security-stamp reads — no schema changes.
 */

export interface IdentityUser {
  id: string;
  userName: string | null;
  email: string | null;
  emailConfirmed: boolean;
  passwordHash: string | null;
  securityStamp: string | null;
  name: string | null;
  userKey: string | null;
  lockoutEnd: Date | null;
  lockoutEnabled: boolean;
  accessFailedCount: number;
}

const USER_COLUMNS = `
  [Id]                AS id,
  [UserName]          AS userName,
  [Email]             AS email,
  [EmailConfirmed]    AS emailConfirmed,
  [PasswordHash]      AS passwordHash,
  [SecurityStamp]     AS securityStamp,
  [Name]              AS name,
  [UserKey]           AS userKey,
  [LockoutEnd]        AS lockoutEnd,
  [LockoutEnabled]    AS lockoutEnabled,
  [AccessFailedCount] AS accessFailedCount
`;

/** Look up a user by email (normalized, case-insensitive) — the login key. */
export async function findUserByEmail(
  email: string,
): Promise<IdentityUser | null> {
  const normalized = email.trim().toUpperCase();
  const rows = await query<IdentityUser>(
    `SELECT TOP 1 ${USER_COLUMNS}
       FROM [AspNetUsers]
      WHERE [NormalizedEmail] = @normalizedEmail`,
    [{ name: "normalizedEmail", type: sql.NVarChar(256), value: normalized }],
  );
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<IdentityUser | null> {
  const rows = await query<IdentityUser>(
    `SELECT TOP 1 ${USER_COLUMNS} FROM [AspNetUsers] WHERE [Id] = @id`,
    [{ name: "id", type: sql.NVarChar(450), value: id }],
  );
  return rows[0] ?? null;
}

/** Just the security stamp — used for cheap session revalidation. */
export async function getSecurityStamp(id: string): Promise<string | null> {
  const rows = await query<{ securityStamp: string | null }>(
    `SELECT [SecurityStamp] AS securityStamp FROM [AspNetUsers] WHERE [Id] = @id`,
    [{ name: "id", type: sql.NVarChar(450), value: id }],
  );
  return rows[0]?.securityStamp ?? null;
}

/** Role names assigned to a user (via AspNetUserRoles → AspNetRoles). */
export async function getUserRoles(userId: string): Promise<string[]> {
  const rows = await query<{ name: string }>(
    `SELECT r.[Name] AS name
       FROM [AspNetUserRoles] ur
       JOIN [AspNetRoles] r ON r.[Id] = ur.[RoleId]
      WHERE ur.[UserId] = @userId`,
    [{ name: "userId", type: sql.NVarChar(450), value: userId }],
  );
  return rows.map((r) => r.name).filter(Boolean);
}

/** Raw permission-override claims (ClaimType = 'Permission'). */
export async function getUserPermissionClaims(
  userId: string,
): Promise<string[]> {
  const rows = await query<{ claimValue: string }>(
    `SELECT [ClaimValue] AS claimValue
       FROM [AspNetUserClaims]
      WHERE [UserId] = @userId AND [ClaimType] = @claimType`,
    [
      { name: "userId", type: sql.NVarChar(450), value: userId },
      { name: "claimType", type: sql.NVarChar(256), value: "Permission" },
    ],
  );
  return rows.map((r) => r.claimValue).filter(Boolean);
}

/** Overwrite a user's password hash (transparent re-hash on login / reset). */
export async function updatePasswordHash(
  userId: string,
  passwordHash: string,
): Promise<void> {
  await query(
    `UPDATE [AspNetUsers] SET [PasswordHash] = @hash WHERE [Id] = @id`,
    [
      { name: "hash", type: sql.NVarChar(sql.MAX), value: passwordHash },
      { name: "id", type: sql.NVarChar(450), value: userId },
    ],
  );
}

// ── Admin: user management (Phase 9 — F11) ───────────────────────────────────

export interface AdminUserRow {
  id: string;
  email: string | null;
  name: string | null;
  userKey: string | null;
  emailConfirmed: boolean;
  lockoutEnd: Date | null;
  roles: string[];
}

/** All users with their assigned role names (for the admin user list). */
export async function listUsers(): Promise<AdminUserRow[]> {
  const users = await query<{
    id: string;
    email: string | null;
    name: string | null;
    userKey: string | null;
    emailConfirmed: boolean;
    lockoutEnd: Date | null;
  }>(
    `SELECT [Id] AS id, [Email] AS email, [Name] AS name, [UserKey] AS userKey,
            [EmailConfirmed] AS emailConfirmed, [LockoutEnd] AS lockoutEnd
       FROM [AspNetUsers] ORDER BY [Email]`,
  );

  const roleRows = await query<{ userId: string; name: string }>(
    `SELECT ur.[UserId] AS userId, r.[Name] AS name
       FROM [AspNetUserRoles] ur
       JOIN [AspNetRoles] r ON r.[Id] = ur.[RoleId]`,
  );
  const byUser = new Map<string, string[]>();
  for (const r of roleRows) {
    if (!byUser.has(r.userId)) byUser.set(r.userId, []);
    byUser.get(r.userId)!.push(r.name);
  }

  return users.map((u) => ({ ...u, roles: byUser.get(u.id) ?? [] }));
}

/** All role names (id + name). */
export async function listRoles(): Promise<{ id: string; name: string }[]> {
  return query<{ id: string; name: string }>(
    `SELECT [Id] AS id, [Name] AS name FROM [AspNetRoles] ORDER BY [Name]`,
  );
}

/** Replace a user's role assignments with exactly `roleNames` (diff add/remove). */
export async function setUserRoles(userId: string, roleNames: string[]): Promise<void> {
  const allRoles = await listRoles();
  const nameToId = new Map(allRoles.map((r) => [r.name, r.id]));
  const desiredIds = new Set(
    roleNames.map((n) => nameToId.get(n)).filter((id): id is string => !!id),
  );

  const currentRows = await query<{ roleId: string }>(
    `SELECT [RoleId] AS roleId FROM [AspNetUserRoles] WHERE [UserId] = @userId`,
    [{ name: "userId", type: sql.NVarChar(450), value: userId }],
  );
  const currentIds = new Set(currentRows.map((r) => r.roleId));

  const toRemove = [...currentIds].filter((id) => !desiredIds.has(id));
  const toAdd = [...desiredIds].filter((id) => !currentIds.has(id));

  for (const roleId of toRemove) {
    await query(
      `DELETE FROM [AspNetUserRoles] WHERE [UserId] = @userId AND [RoleId] = @roleId`,
      [
        { name: "userId", type: sql.NVarChar(450), value: userId },
        { name: "roleId", type: sql.NVarChar(450), value: roleId },
      ],
    );
  }
  for (const roleId of toAdd) {
    await query(
      `INSERT INTO [AspNetUserRoles] ([UserId], [RoleId]) VALUES (@userId, @roleId)`,
      [
        { name: "userId", type: sql.NVarChar(450), value: userId },
        { name: "roleId", type: sql.NVarChar(450), value: roleId },
      ],
    );
  }
}

/**
 * Enable or disable a user. Disable sets a far-future LockoutEnd (+ enables
 * lockout); enable clears it. Both rotate the SecurityStamp so any live session
 * is invalidated at the next stamp revalidation (mirrors Identity's behaviour).
 */
export async function setUserEnabled(userId: string, enabled: boolean): Promise<void> {
  const newStamp = randomUUID().toUpperCase();
  if (enabled) {
    await query(
      `UPDATE [AspNetUsers]
          SET [LockoutEnd] = NULL, [AccessFailedCount] = 0, [SecurityStamp] = @stamp
        WHERE [Id] = @id`,
      [
        { name: "stamp", type: sql.NVarChar(sql.MAX), value: newStamp },
        { name: "id", type: sql.NVarChar(450), value: userId },
      ],
    );
  } else {
    await query(
      `UPDATE [AspNetUsers]
          SET [LockoutEnabled] = 1, [LockoutEnd] = @until, [SecurityStamp] = @stamp
        WHERE [Id] = @id`,
      [
        { name: "until", type: sql.DateTimeOffset, value: new Date("9999-12-31T23:59:59Z") },
        { name: "stamp", type: sql.NVarChar(sql.MAX), value: newStamp },
        { name: "id", type: sql.NVarChar(450), value: userId },
      ],
    );
  }
}

/** Add a permission-override claim if it isn't already present. */
export async function addPermissionClaim(userId: string, value: string): Promise<void> {
  await query(
    `INSERT INTO [AspNetUserClaims] ([UserId], [ClaimType], [ClaimValue])
     SELECT @userId, @claimType, @value
      WHERE NOT EXISTS (
        SELECT 1 FROM [AspNetUserClaims]
         WHERE [UserId] = @userId AND [ClaimType] = @claimType AND [ClaimValue] = @value)`,
    [
      { name: "userId", type: sql.NVarChar(450), value: userId },
      { name: "claimType", type: sql.NVarChar(256), value: "Permission" },
      { name: "value", type: sql.NVarChar(sql.MAX), value },
    ],
  );
}

/** Remove a specific permission-override claim. */
export async function removePermissionClaim(userId: string, value: string): Promise<void> {
  await query(
    `DELETE FROM [AspNetUserClaims]
      WHERE [UserId] = @userId AND [ClaimType] = @claimType AND [ClaimValue] = @value`,
    [
      { name: "userId", type: sql.NVarChar(450), value: userId },
      { name: "claimType", type: sql.NVarChar(256), value: "Permission" },
      { name: "value", type: sql.NVarChar(sql.MAX), value },
    ],
  );
}

// ── Account provisioning + self-service (Phase 9b) ───────────────────────────

/** True if a user with this email already exists (by normalized email). */
export async function emailExists(email: string): Promise<boolean> {
  const rows = await query<{ n: number }>(
    `SELECT COUNT(1) AS n FROM [AspNetUsers] WHERE [NormalizedEmail] = @e`,
    [{ name: "e", type: sql.NVarChar(256), value: email.trim().toUpperCase() }],
  );
  return (rows[0]?.n ?? 0) > 0;
}

/** True if a user with this UserKey already exists (UserKey is UNIQUE). */
export async function userKeyExists(userKey: string): Promise<boolean> {
  const rows = await query<{ n: number }>(
    `SELECT COUNT(1) AS n FROM [AspNetUsers] WHERE [UserKey] = @k`,
    [{ name: "k", type: sql.VarChar(2), value: userKey }],
  );
  return (rows[0]?.n ?? 0) > 0;
}

/**
 * Create a new user (admin-provisioned). PasswordHash is left NULL and
 * EmailConfirmed = 0 — the user sets their password + confirms via an activation
 * link. Column set mirrors the seed script. Returns the new user id.
 */
export async function createUser(input: {
  email: string;
  name: string;
  userKey: string;
}): Promise<string> {
  const id = randomUUID();
  await query(
    `INSERT INTO [AspNetUsers]
       ([Id],[UserName],[NormalizedUserName],[Email],[NormalizedEmail],
        [EmailConfirmed],[PasswordHash],[SecurityStamp],[ConcurrencyStamp],
        [PhoneNumberConfirmed],[TwoFactorEnabled],[LockoutEnabled],[AccessFailedCount],
        [Name],[UserKey])
     VALUES
       (@id,@userName,@nUserName,@email,@nEmail,
        0,NULL,@stamp,@concurrency,
        0,0,1,0,
        @name,@userKey)`,
    [
      { name: "id", type: sql.NVarChar(450), value: id },
      { name: "userName", type: sql.NVarChar(256), value: input.email },
      { name: "nUserName", type: sql.NVarChar(256), value: input.email.toUpperCase() },
      { name: "email", type: sql.NVarChar(256), value: input.email },
      { name: "nEmail", type: sql.NVarChar(256), value: input.email.toUpperCase() },
      { name: "stamp", type: sql.NVarChar(sql.MAX), value: randomUUID().toUpperCase() },
      { name: "concurrency", type: sql.NVarChar(sql.MAX), value: randomUUID() },
      { name: "name", type: sql.NVarChar(sql.MAX), value: input.name },
      { name: "userKey", type: sql.VarChar(2), value: input.userKey },
    ],
  );
  return id;
}

/** Update a user's display name (self-service profile). */
export async function updateUserName(userId: string, name: string): Promise<void> {
  await query(`UPDATE [AspNetUsers] SET [Name] = @name WHERE [Id] = @id`, [
    { name: "name", type: sql.NVarChar(sql.MAX), value: name },
    { name: "id", type: sql.NVarChar(450), value: userId },
  ]);
}

/**
 * Set a password and rotate the SecurityStamp (change/reset). Rotating the stamp
 * invalidates other live sessions at the next revalidation.
 */
export async function setPassword(userId: string, passwordHash: string): Promise<void> {
  await query(
    `UPDATE [AspNetUsers]
        SET [PasswordHash] = @hash, [SecurityStamp] = @stamp, [AccessFailedCount] = 0
      WHERE [Id] = @id`,
    [
      { name: "hash", type: sql.NVarChar(sql.MAX), value: passwordHash },
      { name: "stamp", type: sql.NVarChar(sql.MAX), value: randomUUID().toUpperCase() },
      { name: "id", type: sql.NVarChar(450), value: userId },
    ],
  );
}

/** Set the initial password AND confirm the account (activation). Rotates the stamp. */
export async function setPasswordAndConfirm(userId: string, passwordHash: string): Promise<void> {
  await query(
    `UPDATE [AspNetUsers]
        SET [PasswordHash] = @hash, [EmailConfirmed] = 1,
            [SecurityStamp] = @stamp, [LockoutEnd] = NULL, [AccessFailedCount] = 0
      WHERE [Id] = @id`,
    [
      { name: "hash", type: sql.NVarChar(sql.MAX), value: passwordHash },
      { name: "stamp", type: sql.NVarChar(sql.MAX), value: randomUUID().toUpperCase() },
      { name: "id", type: sql.NVarChar(450), value: userId },
    ],
  );
}
