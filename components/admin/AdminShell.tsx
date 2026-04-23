"use client";

import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sidebar } from "./Sidebar";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

type AdminProfile = {
  full_name: string | null;
  role: string | null;
};

function getInitials(name?: string | null, email?: string | null) {
  const cleanedName = name?.trim();

  if (cleanedName) {
    const initials = cleanedName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("");

    return initials.toUpperCase();
  }

  return email?.trim()[0]?.toUpperCase() ?? "A";
}

export function AdminShell({
  children,
  logsEnabled,
  posSalesEnabled,
}: {
  children: ReactNode;
  logsEnabled: boolean;
  posSalesEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email ?? null);
        const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();
        setProfile(profile);
      }
    };
    fetchProfile();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  const displayName = profile?.full_name?.trim() || email || "Admin";
  const initials = getInitials(profile?.full_name, email);
  const role = profile?.role ?? undefined;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-none">
        <Sidebar
          role={role}
          logsEnabled={logsEnabled}
          posSalesEnabled={posSalesEnabled}
          collapsed={sidebarCollapsed}
          onPosClick={() => setSidebarCollapsed(true)}
        />
      </div>

      {/* Mobile sidebar drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="inset-0 h-dvh w-screen max-w-none gap-0 border-0 bg-white p-0 shadow-none"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar
            onClose={() => setOpen(false)}
            role={role}
            logsEnabled={logsEnabled}
            posSalesEnabled={posSalesEnabled}
            borderless
            fullWidth
          />
        </SheetContent>
      </Sheet>
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b flex items-center justify-between gap-3 px-4 md:px-6 bg-white">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
              onClick={() => setSidebarCollapsed((current) => !current)}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <BrandLogo size={28} className="md:hidden" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Open profile menu">
                <Avatar>
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <Settings />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut} variant="destructive">
                <LogOut />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
