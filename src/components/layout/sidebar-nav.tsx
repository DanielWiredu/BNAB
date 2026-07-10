"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  Banknote,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Gauge,
  HandCoins,
  Inbox,
  Layers,
  Plug,
  ReceiptText,
  Server,
  Shield,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { usePermissions } from "@/features/auth/permission-context";
import { NAV, isGroup, type NavItem, type NavGroup, type NavLeaf } from "./nav-items";

const ICONS: Record<string, LucideIcon> = {
  gauge: Gauge,
  users: Users,
  inbox: Inbox,
  "clipboard-check": ClipboardCheck,
  banknote: Banknote,
  "receipt-text": ReceiptText,
  "hand-coins": HandCoins,
  wrench: Wrench,
  "file-text": FileText,
  server: Server,
  plug: Plug,
  layers: Layers,
  archive: Archive,
  shield: Shield,
};

export function SidebarNav() {
  const { has, hasAny } = usePermissions();

  function leafVisible(leaf: NavLeaf): boolean {
    if (leaf.permission) return has(leaf.permission);
    if (leaf.anyOf) return hasAny(...leaf.anyOf);
    return true;
  }

  function itemVisible(item: NavItem): boolean {
    if (isGroup(item)) return item.children.some(itemVisible);
    return leafVisible(item);
  }

  const visible = NAV.filter(itemVisible);

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)]">
      <div className="flex h-16 items-center gap-2 px-5 text-lg font-bold tracking-tight">
        GDLC <span className="text-[var(--primary)]">LAMS</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-muted)]">
          Navigation
        </p>
        <ul className="space-y-0.5">
          {visible.map((item) => (
            <NavNode key={item.label} item={item} depth={0} visible={itemVisible} leafVisible={leafVisible} />
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function NavNode({
  item,
  depth,
  visible,
  leafVisible,
}: {
  item: NavItem;
  depth: number;
  visible: (i: NavItem) => boolean;
  leafVisible: (l: NavLeaf) => boolean;
}) {
  const pathname = usePathname();

  if (!isGroup(item)) {
    const active = pathname === item.href;
    const Icon = item.icon ? ICONS[item.icon] : undefined;
    return (
      <li>
        <Link
          href={item.href}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
            active
              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
              : "text-[var(--sidebar-foreground)]/80 hover:bg-[var(--sidebar-accent)]",
            depth > 0 && "pl-8 text-[13px]",
          )}
        >
          {Icon && <Icon className="size-4 shrink-0" />}
          <span>{item.label}</span>
        </Link>
      </li>
    );
  }

  return <NavGroupNode group={item} depth={depth} visible={visible} leafVisible={leafVisible} />;
}

function NavGroupNode({
  group,
  depth,
  visible,
  leafVisible,
}: {
  group: NavGroup;
  depth: number;
  visible: (i: NavItem) => boolean;
  leafVisible: (l: NavLeaf) => boolean;
}) {
  const pathname = usePathname();
  const children = group.children.filter(visible);
  const containsActive = children.some(
    (c) => !isGroup(c) && pathname === (c as NavLeaf).href,
  );
  const [open, setOpen] = useState(containsActive);
  const Icon = group.icon ? ICONS[group.icon] : undefined;

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-[var(--sidebar-foreground)]/80 transition-colors hover:bg-[var(--sidebar-accent)]",
          depth > 0 && "pl-8 text-[13px]",
        )}
        aria-expanded={open}
      >
        {Icon && <Icon className="size-4 shrink-0" />}
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronRight
          className={cn("size-4 transition-transform", open && "rotate-90")}
        />
      </button>
      {open && (
        <ul className="mt-0.5 space-y-0.5 border-l border-[var(--sidebar-accent)] pl-2">
          {children.map((child) => (
            <NavNode
              key={child.label}
              item={child}
              depth={depth + 1}
              visible={visible}
              leafVisible={leafVisible}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
