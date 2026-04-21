"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, ShoppingCart, Tags, Users, LogOut, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/listings", label: "Listings", icon: Package, exact: false },
  { href: "/admin/categories", label: "Categories", icon: Tags, exact: false },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart, exact: false },
  { href: "/admin/users", label: "Users", icon: Users, exact: false },
  { href: "/admin/logs", label: "Logs", icon: ClipboardList, exact: false },
];

interface SidebarProps {
  onClose?: () => void;
  role?: string;
}

export function Sidebar({ onClose, role }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  const filteredNavItems = navItems.filter((item) => {
    if (role === "staff" && item.href === "/admin/users") return false;
    if (role === "staff" && item.href === "/admin/logs") return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full w-64 bg-white border-r">
      <div className="h-14 flex items-center px-4 border-b">
        <BrandLogo size={32} suffix="Admin Panel" />
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {filteredNavItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4 flex-none" />
              {label}
            </Link>
          );
        })}
      </nav>
      {/* ... (rest of the component) ... */}
      <button
        onClick={handleSignOut}
        className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors"
      >
        <LogOut className="h-4 w-4 flex-none" />
        Sign Out
      </button>
    </div>
  );
}
