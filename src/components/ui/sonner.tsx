"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[var(--card)] group-[.toaster]:text-[var(--card-foreground)] group-[.toaster]:border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-[var(--muted-foreground)]",
        },
      }}
      {...props}
    />
  );
}
