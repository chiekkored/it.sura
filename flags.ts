import { vercelAdapter } from "@flags-sdk/vercel";
import { dedupe, flag } from "flags/next";
import { createClient } from "@/lib/supabase/server";

type AdminFlagEntities = {
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
};

const identifyAdmin = dedupe(async (): Promise<AdminFlagEntities> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return {};

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  return {
    user: {
      id: user.id,
      email: user.email,
      role: profile?.role,
    },
  };
});

const adminLogsFlagDefinition = {
  key: "admin-logs",
  defaultValue: false,
  identify: identifyAdmin,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
  description: "Enable admin activity log writes, API access, and the admin logs page.",
};

export const adminLogsEnabled = process.env.FLAGS
  ? flag<boolean, AdminFlagEntities>({
      ...adminLogsFlagDefinition,
      adapter: vercelAdapter(),
    })
  : flag<boolean, AdminFlagEntities>({
      ...adminLogsFlagDefinition,
      decide: () => false,
    });
