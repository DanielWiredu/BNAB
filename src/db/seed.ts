/**
 * Startup seeding — ports the role + admin-user seeding from LAMS.Server Program.cs.
 *
 * - Ensures all AppRoles exist in AspNetRoles.
 * - For each SEED_ADMIN_EMAILS entry: creates the user (if missing and a default
 *   password is configured) with a confirmed account, then assigns every role.
 *
 * Run with:  npm run seed
 *
 * Uses node-mssql directly against the Identity tables (no Prisma dependency),
 * writing password hashes in the shared Identity V3 format so the legacy app can
 * still authenticate the seeded accounts.
 */

import "../lib/env";
import { randomUUID } from "node:crypto";

import { getPool, sql } from "./mssql";
import { ALL_ROLES } from "../server/auth/permissions";
import { hashIdentityPassword } from "../server/auth/identity-hash";

async function ensureRole(name: string): Promise<string> {
  const pool = await getPool();
  const existing = await pool
    .request()
    .input("normalized", sql.NVarChar(256), name.toUpperCase())
    .query<{ Id: string }>(
      `SELECT [Id] FROM [AspNetRoles] WHERE [NormalizedName] = @normalized`,
    );
  if (existing.recordset[0]) return existing.recordset[0].Id;

  const id = randomUUID();
  await pool
    .request()
    .input("id", sql.NVarChar(450), id)
    .input("name", sql.NVarChar(256), name)
    .input("normalized", sql.NVarChar(256), name.toUpperCase())
    .input("stamp", sql.NVarChar(sql.MAX), randomUUID())
    .query(
      `INSERT INTO [AspNetRoles] ([Id],[Name],[NormalizedName],[ConcurrencyStamp])
       VALUES (@id, @name, @normalized, @stamp)`,
    );
  console.log(`  + role created: ${name}`);
  return id;
}

async function findUserId(email: string): Promise<string | null> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input("normalized", sql.NVarChar(256), email.toUpperCase())
    .query<{ Id: string }>(
      `SELECT [Id] FROM [AspNetUsers] WHERE [NormalizedEmail] = @normalized`,
    );
  return res.recordset[0]?.Id ?? null;
}

async function createAdminUser(
  email: string,
  password: string,
): Promise<string> {
  const pool = await getPool();
  const id = randomUUID();
  const userKey = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

  await pool
    .request()
    .input("id", sql.NVarChar(450), id)
    .input("userName", sql.NVarChar(256), email)
    .input("normalizedUserName", sql.NVarChar(256), email.toUpperCase())
    .input("email", sql.NVarChar(256), email)
    .input("normalizedEmail", sql.NVarChar(256), email.toUpperCase())
    .input("passwordHash", sql.NVarChar(sql.MAX), hashIdentityPassword(password))
    .input("securityStamp", sql.NVarChar(sql.MAX), randomUUID())
    .input("concurrencyStamp", sql.NVarChar(sql.MAX), randomUUID())
    .input("name", sql.NVarChar(sql.MAX), "System Admin")
    .input("userKey", sql.NVarChar(sql.MAX), userKey)
    .query(
      `INSERT INTO [AspNetUsers]
        ([Id],[UserName],[NormalizedUserName],[Email],[NormalizedEmail],
         [EmailConfirmed],[PasswordHash],[SecurityStamp],[ConcurrencyStamp],
         [PhoneNumberConfirmed],[TwoFactorEnabled],[LockoutEnabled],[AccessFailedCount],
         [Name],[UserKey])
       VALUES
        (@id,@userName,@normalizedUserName,@email,@normalizedEmail,
         1,@passwordHash,@securityStamp,@concurrencyStamp,
         0,0,1,0,
         @name,@userKey)`,
    );
  console.log(`  + admin user created: ${email}`);
  return id;
}

async function assignRole(userId: string, roleId: string): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("userId", sql.NVarChar(450), userId)
    .input("roleId", sql.NVarChar(450), roleId)
    .query(
      `IF NOT EXISTS (SELECT 1 FROM [AspNetUserRoles] WHERE [UserId]=@userId AND [RoleId]=@roleId)
         INSERT INTO [AspNetUserRoles] ([UserId],[RoleId]) VALUES (@userId,@roleId)`,
    );
}

async function main() {
  console.log("Seeding roles and admin users…");

  const roleIds = new Map<string, string>();
  for (const role of ALL_ROLES) {
    roleIds.set(role, await ensureRole(role));
  }

  const emails = (process.env.SEED_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const defaultPassword = process.env.SEED_ADMIN_DEFAULT_PASSWORD ?? "";

  for (const email of emails) {
    let userId = await findUserId(email);
    if (!userId) {
      if (!defaultPassword) {
        console.log(
          `  ~ ${email}: not found and SEED_ADMIN_DEFAULT_PASSWORD is empty — skipping creation.`,
        );
        continue;
      }
      userId = await createAdminUser(email, defaultPassword);
    }
    for (const roleId of roleIds.values()) {
      await assignRole(userId, roleId);
    }
    console.log(`  = ${email}: all roles assigned.`);
  }

  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
