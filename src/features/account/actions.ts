"use server";

import { revalidatePath } from "next/cache";

import {
  createUserSchema,
  setPasswordSchema,
  forgotPasswordSchema,
  profileSchema,
  changePasswordSchema,
} from "./schema";
import {
  createUser,
  emailExists,
  userKeyExists,
  findUserByEmail,
  findUserById,
  getSecurityStamp,
  updateUserName,
  setPassword,
  setPasswordAndConfirm,
} from "@/server/repositories/user-repository";
import {
  createActionToken,
  verifyActionToken,
  hashStamp,
} from "@/server/auth/action-token";
import { hashIdentityPassword, verifyIdentityPassword } from "@/server/auth/identity-hash";
import { enqueueEmail } from "@/server/email/email-queue";
import { accountActivationEmail, passwordResetEmail } from "@/emails/templates";
import { Permissions as P } from "@/server/auth/permissions";
import { getCurrentUser } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { logAction } from "@/server/audit/audit-log";
import { logger } from "@/lib/logger";

export type ActionResult = { ok: true } | { ok: false; error: string };

const ACTIVATE_TTL = 3 * 24 * 60 * 60; // 3 days
const RESET_TTL = 60 * 60; // 1 hour

function baseUrl(): string {
  return (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

// ── Admin: create user + activation email ────────────────────────────────────

export async function adminCreateUser(values: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You are not signed in." };
  if (!(await hasPermission(user.id, P.Admin.Users))) {
    return { ok: false, error: "You don't have permission to do that." };
  }

  const parsed = createUserSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const v = parsed.data;

  try {
    if (await emailExists(v.email)) return { ok: false, error: "A user with that email already exists." };
    if (await userKeyExists(v.userKey)) return { ok: false, error: "That User Key is already in use." };

    const newId = await createUser({ email: v.email, name: v.name, userKey: v.userKey });
    const stamp = await getSecurityStamp(newId);
    const token = createActionToken(newId, "activate", stamp, ACTIVATE_TTL);
    const email = accountActivationEmail({
      name: v.name,
      activateUrl: `${baseUrl()}/activate?token=${encodeURIComponent(token)}`,
    });
    await enqueueEmail({ to: v.email, subject: email.subject, html: email.html, text: email.text });

    await logAction("CREATE User", v.email);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "adminCreateUser failed");
    return { ok: false, error: "Could not create the user. Please try again." };
  }
}

// ── Forgot / reset password ──────────────────────────────────────────────────

/** Always returns ok — never reveals whether an email is registered. */
export async function requestPasswordReset(values: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  try {
    const user = await findUserByEmail(parsed.data.email);
    if (user) {
      const token = createActionToken(user.id, "reset", user.securityStamp, RESET_TTL);
      const email = passwordResetEmail({
        name: user.name,
        resetUrl: `${baseUrl()}/reset-password?token=${encodeURIComponent(token)}`,
      });
      await enqueueEmail({
        to: user.email ?? parsed.data.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
    }
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "requestPasswordReset failed");
    // Still return ok to avoid leaking; the email just won't arrive.
    return { ok: true };
  }
}

async function applyToken(
  token: string,
  purpose: "activate" | "reset",
  password: string,
  apply: (userId: string, hash: string) => Promise<void>,
): Promise<ActionResult> {
  const parsed = setPasswordSchema.safeParse({ password, confirmPassword: password });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid password." };

  const verified = verifyActionToken(token, purpose);
  if (!verified) return { ok: false, error: "This link is invalid or has expired." };

  const stamp = await getSecurityStamp(verified.userId);
  if (hashStamp(stamp) !== verified.stampHash) {
    return { ok: false, error: "This link has already been used or is no longer valid." };
  }

  await apply(verified.userId, hashIdentityPassword(password));
  return { ok: true };
}

export async function activateAccount(token: string, password: string): Promise<ActionResult> {
  try {
    const res = await applyToken(token, "activate", password, setPasswordAndConfirm);
    if (res.ok) await logAction("ACTIVATE Account", null);
    return res;
  } catch (err) {
    logger.error({ err }, "activateAccount failed");
    return { ok: false, error: "Could not activate the account. Please try again." };
  }
}

export async function resetPassword(token: string, password: string): Promise<ActionResult> {
  try {
    const res = await applyToken(token, "reset", password, setPassword);
    if (res.ok) await logAction("RESET Password", null);
    return res;
  } catch (err) {
    logger.error({ err }, "resetPassword failed");
    return { ok: false, error: "Could not reset the password. Please try again." };
  }
}

// ── Self-service profile + change password ───────────────────────────────────

export async function updateProfile(values: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You are not signed in." };
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  try {
    await updateUserName(user.id, parsed.data.name);
    await logAction("UPDATE Profile", user.id);
    revalidatePath("/account");
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "updateProfile failed");
    return { ok: false, error: "Could not update your profile." };
  }
}

export async function changePassword(values: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You are not signed in." };
  const parsed = changePasswordSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  try {
    const record = await findUserById(user.id);
    if (!record) return { ok: false, error: "Account not found." };
    if (!verifyIdentityPassword(record.passwordHash, parsed.data.currentPassword)) {
      return { ok: false, error: "Your current password is incorrect." };
    }
    await setPassword(user.id, hashIdentityPassword(parsed.data.password));
    await logAction("CHANGE Password", user.id);
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "changePassword failed");
    return { ok: false, error: "Could not change your password." };
  }
}
