import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity-logs";
import { userUpdateSchema } from "@/lib/validators/user";

type ProfileUpdate = {
  full_name?: string;
  role?: "superadmin" | "admin" | "staff";
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const supabase = await createClient();
  const { data: { user: adminUser } } = await supabase.auth.getUser();
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Additional role check
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", adminUser.id)
    .single();

  if (!adminProfile || !["superadmin", "admin"].includes(adminProfile.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Check if target user is superadmin
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", id)
    .single();

  // Rule: Only superadmins can modify superadmins
  if (targetProfile?.role === "superadmin" && adminProfile.role !== "superadmin") {
    return NextResponse.json({ error: "Only superadmins can modify superadmins" }, { status: 403 });
  }

  // Parse and validate body
  const body = await request.json();
  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();
  const { fullName, password, role } = parsed.data;

  if (password && adminProfile.role !== "superadmin" && adminUser.id !== id) {
    return NextResponse.json({ error: "You cannot change another user's password" }, { status: 403 });
  }

  if (password) {
    const { error: passwordError } = await adminClient.auth.admin.updateUserById(id, { password });

    if (passwordError) {
      return NextResponse.json({ error: passwordError.message }, { status: 500 });
    }

    await logActivity({
      actorId: adminUser.id,
      actorRole: adminProfile.role,
      action: "user.change_password",
      entityType: "user",
      entityId: id,
      entityLabel: targetProfile?.full_name ?? fullName ?? null,
      metadata: {
        self: adminUser.id === id,
      },
    });
  }

  const profileUpdate: ProfileUpdate = {};
  if (fullName !== undefined) profileUpdate.full_name = fullName;
  if (role !== undefined) profileUpdate.role = role;

  if (!Object.keys(profileUpdate).length) {
    return NextResponse.json({ success: true });
  }

  // Use Admin Client to update profile (roles might need admin client if RLS is strict)
  const { data, error } = await adminClient
    .from("profiles")
    .update(profileUpdate)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logActivity({
    actorId: adminUser.id,
    actorRole: adminProfile.role,
    action: "user.update",
    entityType: "user",
    entityId: id,
    entityLabel: data.full_name,
    metadata: {
      previous_name: targetProfile?.full_name ?? null,
      previous_role: targetProfile?.role ?? null,
      next_role: data.role,
    },
  });

  return NextResponse.json(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user: adminUser } } = await supabase.auth.getUser();
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Additional role check
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", adminUser.id)
    .single();

  if (!adminProfile || !["superadmin", "admin"].includes(adminProfile.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Check if target user is superadmin
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", id)
    .single();

  // Rule: Only superadmins can delete superadmins
  if (targetProfile?.role === "superadmin" && adminProfile.role !== "superadmin") {
    return NextResponse.json({ error: "Only superadmins can delete superadmins" }, { status: 403 });
  }

  // Prevent self-deletion
  if (adminUser.id === id) {
    return NextResponse.json({ error: "You cannot delete yourself" }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logActivity({
    actorId: adminUser.id,
    actorRole: adminProfile.role,
    action: "user.delete",
    entityType: "user",
    entityId: id,
    entityLabel: targetProfile?.full_name ?? null,
    metadata: {
      role: targetProfile?.role ?? null,
    },
  });

  return NextResponse.json({ success: true });
}
