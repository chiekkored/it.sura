"use client";

import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./Sidebar";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
// ... (rest of imports)

export function AdminShell({ children, logsEnabled }: { children: ReactNode; logsEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string | undefined>();

  useEffect(() => {
    const fetchRole = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        setRole(profile?.role ?? undefined);
      }
    };
    fetchRole();
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-none">
        <Sidebar role={role} logsEnabled={logsEnabled} />
      </div>

      {/* Mobile sidebar drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar onClose={() => setOpen(false)} role={role} logsEnabled={logsEnabled} />
        </SheetContent>
      </Sheet>
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b flex items-center gap-3 px-4 md:px-6 bg-white">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <BrandLogo size={28} className="md:hidden" />
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
