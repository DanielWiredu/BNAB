"use client";

import Link from "next/link";
import { LogOut, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { logout } from "@/features/auth/actions";

export function Topbar({
  name,
  email,
  roles,
}: {
  name: string | null;
  email: string | null;
  roles: string[];
}) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-[var(--card)] px-6">
      <div className="text-sm text-[var(--muted-foreground)]">
        {roles.length > 0 ? roles.join(" · ") : "No role assigned"}
      </div>
      <div className="flex items-center gap-4">
        <Link
          href="/account"
          className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-[var(--secondary)]"
          title="My account"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-[var(--secondary)]">
            <User className="size-4" />
          </span>
          <div className="leading-tight">
            <div className="font-medium">{name ?? email ?? "User"}</div>
            {email && (
              <div className="text-xs text-[var(--muted-foreground)]">
                {email}
              </div>
            )}
          </div>
        </Link>
        <form action={logout}>
          <Button type="submit" variant="ghost" size="sm">
            <LogOut className="size-4" />
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
