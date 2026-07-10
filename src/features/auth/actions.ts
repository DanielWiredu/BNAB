"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";

export interface LoginState {
  error?: string;
}

export async function authenticate(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    // Re-throw redirects (NEXT_REDIRECT) and anything unexpected.
    throw error;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
