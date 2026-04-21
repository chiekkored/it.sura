import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-logs";
import { categorySchema } from "@/lib/validators/category";

async function requireAdminSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["superadmin", "admin", "staff"].includes(profile.role)) {
    return { supabase, error: NextResponse.json({ error: "Unauthorized" }, { status: 403 }) };
  }

  return { supabase, user, profile, error: null };
}

export async function POST(request: Request) {
  const { supabase, user, profile, error: authError } = await requireAdminSession();
  if (authError) return authError;

  const body = await request.json();
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity({
    actorId: user.id,
    actorRole: profile.role,
    action: "category.create",
    entityType: "category",
    entityId: data.id,
    entityLabel: data.name,
    metadata: { slug: data.slug },
  });

  return NextResponse.json(data, { status: 201 });
}
