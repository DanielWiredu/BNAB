"use client";

import { useActionState } from "react";

import { authenticate, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    authenticate,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div
          role="alert"
          className="rounded-md border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]"
        >
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="name@example.com"
          autoComplete="username"
          required
          aria-required="true"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
          aria-required="true"
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Log in"}
      </Button>

      <div className="text-center text-sm">
        <a
          href="/forgot-password"
          className="text-[var(--muted-foreground)] underline-offset-4 hover:underline"
        >
          Forgot your password?
        </a>
      </div>
    </form>
  );
}
