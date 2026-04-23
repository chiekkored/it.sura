"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  LayoutDashboard,
  Package,
  Receipt,
  ShoppingCart,
  Store,
  Tags,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/listings", label: "Listings", icon: Package, exact: false },
  { href: "/admin/categories", label: "Categories", icon: Tags, exact: false },
  { href: "/admin/users", label: "Users", icon: Users, exact: false },
  { href: "/admin/logs", label: "Logs", icon: ClipboardList, exact: false },
];

const transactionItems = [
  { href: "/admin/transactions/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/transactions/sales", label: "Sales", icon: Receipt },
];

interface SidebarProps {
  onClose?: () => void;
  role?: string;
  logsEnabled: boolean;
  posSalesEnabled: boolean;
  collapsed?: boolean;
  onPosClick?: () => void;
  borderless?: boolean;
  fullWidth?: boolean;
}

export function Sidebar({
  onClose,
  role,
  logsEnabled,
  posSalesEnabled,
  collapsed = false,
  onPosClick,
  borderless = false,
  fullWidth = false,
}: SidebarProps) {
  const pathname = usePathname();

  const filteredNavItems = navItems.filter((item) => {
    if (role === "staff" && item.href === "/admin/users") return false;
    if (item.href === "/admin/logs" && (role === "staff" || !logsEnabled)) return false;
    return true;
  });

  const visibleTransactionItems = transactionItems.filter((item) => item.href !== "/admin/transactions/sales" || posSalesEnabled);

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-white transition-[width] duration-200",
        !borderless && "border-r",
        fullWidth ? "w-full" : collapsed ? "w-16" : "w-64",
      )}
    >
      <div className={cn("h-14 flex items-center", !borderless && "border-b", collapsed ? "justify-center px-2" : "px-4")}>
        <BrandLogo size={32} showText={!collapsed} suffix={collapsed ? undefined : "Admin Panel"} />
      </div>
      <nav className="flex-1 space-y-1 px-2 py-4">
        {filteredNavItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-2",
                active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4 flex-none" />
              {!collapsed && label}
            </Link>
          );
        })}
        <div className="pt-4">
          {!collapsed && (
            <p className="px-3 pb-1 text-xs font-medium uppercase text-muted-foreground">Transactions</p>
          )}
          <div className="space-y-1">
            {visibleTransactionItems.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href) || (href.endsWith("/orders") && pathname.startsWith("/admin/orders"));

              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  title={collapsed ? label : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    collapsed && "justify-center px-2",
                    active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4 flex-none" />
                  {!collapsed && label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      {posSalesEnabled && (
        <div className={cn("p-2", !borderless && "border-t")}>
          <Link
            href="/admin/pos"
            onClick={() => {
              onPosClick?.();
              onClose?.();
            }}
            title={collapsed ? "Point of Sale" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              collapsed && "justify-center px-2",
              pathname.startsWith("/admin/pos")
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Store className="h-4 w-4 flex-none" />
            {!collapsed && "Point of Sale"}
          </Link>
        </div>
      )}
    </div>
  );
}
