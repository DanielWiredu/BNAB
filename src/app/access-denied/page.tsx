import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <div className="text-6xl font-bold text-[var(--muted-foreground)]">403</div>
      <h1 className="text-xl font-semibold">Access denied</h1>
      <p className="max-w-sm text-sm text-[var(--muted-foreground)]">
        You don&apos;t have permission to view this page. If you believe this is
        an error, contact an administrator.
      </p>
      <Button asChild>
        <Link href="/">Back to dashboard</Link>
      </Button>
    </div>
  );
}
