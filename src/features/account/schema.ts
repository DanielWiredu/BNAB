import { z } from "zod";

const password = z.string().min(8, "Password must be at least 8 characters");

export const createUserSchema = z.object({
  email: z.string().trim().email("A valid email is required"),
  name: z.string().trim().min(1, "Name is required"),
  userKey: z
    .string()
    .trim()
    .min(1, "User Key is required")
    .max(2, "User Key must be 1–2 characters")
    .transform((v) => v.toUpperCase()),
});
export type CreateUserValues = z.infer<typeof createUserSchema>;

export const setPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type SetPasswordValues = z.infer<typeof setPasswordSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("A valid email is required"),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
