import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/AdminShell";
import type { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  // Check if user has admin/staff role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["superadmin", "admin", "staff"].includes(profile.role)) {
    // If not admin/staff, sign out and redirect to login
    await supabase.auth.signOut();
    redirect("/admin/login?error=Unauthorized");
  }

  // Prevent staff from accessing restricted admin management pages
  const headersList = (await import("next/headers")).headers();
  const path = (await headersList).get("x-invoke-path") || "";
  
  if (profile.role === "staff" && (path.startsWith("/admin/users") || path.startsWith("/admin/logs"))) {
      redirect("/admin");
  }

  return <AdminShell>{children}</AdminShell>;
}
