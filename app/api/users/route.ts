import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity-logs";
import { userCreateSchema } from "@/lib/validators/user";

export async function POST(request: Request) {
  // 1. Verify standard client session (admin check)
  const supabase = await createClient();
  const { data: { user: adminUser } } = await supabase.auth.getUser();
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Additional role check for security
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", adminUser.id)
    .single();

  if (!adminProfile || !["superadmin", "admin"].includes(adminProfile.role)) {
    return NextResponse.json({ error: "Only admins can create users" }, { status: 403 });
  }

  // 3. Parse and validate body
  const body = await request.json();
  const parsed = userCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message },
      { status: 400 }
    );
  }

  const { email, password, fullName, role } = parsed.data;

  // 4. Use Admin Client to create Auth user
  const adminClient = createAdminClient();
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { 
      full_name: fullName,
      role: role
    },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  await logActivity({
    actorId: adminUser.id,
    actorRole: adminProfile.role,
    action: "user.create",
    entityType: "user",
    entityId: authData.user?.id ?? null,
    entityLabel: fullName,
    metadata: {
      email,
      role,
    },
  });

  return NextResponse.json({ user: authData.user }, { status: 201 });
}
