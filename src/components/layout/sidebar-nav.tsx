"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
  PanelLeftClose,
  PanelLeftOpen,
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
import { COMPANY_NAME } from "@/lib/branding";
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

const STORAGE_KEY = "lams.sidebar.collapsed";

interface SidebarState {
  collapsed: boolean;
  /** Expand the rail (used when a collapsed group icon is clicked). */
  expand: () => void;
}
const SidebarContext = createContext<SidebarState>({ collapsed: false, expand: () => {} });

export function SidebarNav() {
  const { has, hasAny } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);

  // Restore the persisted state on mount (kept out of the initial render to
  // avoid a hydration mismatch).
  useEffect(() => {
    if (typeof window === "undefined") return;
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

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
    <SidebarContext.Provider value={{ collapsed, expand: () => setCollapsed(false) }}>
      <aside
        className={cn(
          "flex h-screen shrink-0 flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)] transition-[width] duration-200 ease-in-out",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center px-3",
            collapsed ? "justify-center" : "justify-between px-5",
          )}
        >
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight">
              {COMPANY_NAME} <span className="text-[var(--primary)]">LAMS</span>
            </span>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex size-8 items-center justify-center rounded-md text-[var(--sidebar-foreground)]/70 transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]"
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-6">
          {!collapsed && (
            <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-muted)]">
              Navigation
            </p>
          )}
          <ul className={cn("space-y-0.5", collapsed && "mt-2")}>
            {visible.map((item) => (
              <NavNode key={item.label} item={item} depth={0} visible={itemVisible} leafVisible={leafVisible} />
            ))}
          </ul>
        </nav>
      </aside>
    </SidebarContext.Provider>
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
  const { collapsed } = useContext(SidebarContext);

  if (!isGroup(item)) {
    const active = pathname === item.href;
    const Icon = item.icon ? ICONS[item.icon] : undefined;
    return (
      <li>
        <Link
          href={item.href}
          title={collapsed ? item.label : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
            active
              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
              : "text-[var(--sidebar-foreground)]/80 hover:bg-[var(--sidebar-accent)]",
            depth > 0 && !collapsed && "pl-8 text-[13px]",
            collapsed && "justify-center px-0",
          )}
        >
          {Icon && <Icon className="size-4 shrink-0" />}
          {!collapsed && <span>{item.label}</span>}
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
  const { collapsed, expand } = useContext(SidebarContext);
  const children = group.children.filter(visible);
  const containsActive = children.some(
    (c) => !isGroup(c) && pathname === (c as NavLeaf).href,
  );
  const [open, setOpen] = useState(containsActive);
  const Icon = group.icon ? ICONS[group.icon] : undefined;

  // Collapsed rail: render the group as a single icon button that expands the
  // sidebar (and opens this group) on click — no inline children.
  if (collapsed) {
    return (
      <li>
        <button
          type="button"
          title={group.label}
          onClick={() => {
            expand();
            setOpen(true);
          }}
          className={cn(
            "flex w-full items-center justify-center rounded-md px-0 py-2 text-sm transition-colors",
            containsActive
              ? "text-[var(--primary)]"
              : "text-[var(--sidebar-foreground)]/80 hover:bg-[var(--sidebar-accent)]",
          )}
        >
          {Icon && <Icon className="size-4 shrink-0" />}
        </button>
      </li>
    );
  }

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
