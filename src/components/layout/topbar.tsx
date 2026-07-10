"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, KeyRound, LogOut, User } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { logout } from "@/features/auth/actions";

/** A small, deterministic accent color per role name (dot on the pill). */
const ROLE_DOTS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
];

function roleDot(role: string): string {
  let hash = 0;
  for (let i = 0; i < role.length; i++) hash = (hash * 31 + role.charCodeAt(i)) >>> 0;
  return ROLE_DOTS[hash % ROLE_DOTS.length];
}

function RolePill({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--secondary)] px-2 py-0.5 text-xs font-medium text-[var(--secondary-foreground)]">
      <span className={cn("size-1.5 rounded-full", roleDot(role))} />
      {role}
    </span>
  );
}

export function Topbar({
  name,
  email,
  roles,
}: {
  name: string | null;
  email: string | null;
  roles: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hover-to-open with a small close delay so moving cursor to the menu
  // doesn't dismiss it. Click / keyboard still work via onOpenChange.
  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }
  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

  const displayName = name ?? email ?? "User";

  return (
    <header className="flex h-16 items-center justify-end gap-4 border-b bg-[var(--card)] px-6">
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <div
          onMouseEnter={() => {
            cancelClose();
            setOpen(true);
          }}
          onMouseLeave={scheduleClose}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm outline-none transition-colors hover:bg-[var(--secondary)] focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">
                <User className="size-4" />
              </span>
              <span className="hidden text-left leading-tight md:block">
                <span className="block font-medium">{displayName}</span>
                {email && (
                  <span className="block text-xs text-[var(--muted-foreground)]">{email}</span>
                )}
              </span>
              <ChevronDown
                className={cn("size-4 text-[var(--muted-foreground)] transition-transform", open && "rotate-180")}
              />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-64"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="truncate">{displayName}</span>
              {email && (
                <span className="truncate text-xs font-normal text-[var(--muted-foreground)]">{email}</span>
              )}
            </DropdownMenuLabel>

            <div className="flex flex-wrap gap-1 px-2 pb-1.5">
              {roles.length > 0 ? (
                roles.map((r) => <RolePill key={r} role={r} />)
              ) : (
                <span className="text-xs italic text-[var(--muted-foreground)]">No role assigned</span>
              )}
            </div>

            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/account")}>
              <User />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/account/password")}>
              <KeyRound />
              Change Password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-[var(--destructive)] focus:text-[var(--destructive)]"
              onSelect={() => logout()}
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </div>
      </DropdownMenu>
    </header>
  );
}
