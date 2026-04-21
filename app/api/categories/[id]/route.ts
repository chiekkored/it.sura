import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-logs";
import { categorySchema } from "@/lib/validators/category";

interface Context {
  params: Promise<{ id: string }>;
}

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

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  const { supabase, user, profile, error: authError } = await requireAdminSession();
  if (authError) return authError;

  const body = await request.json();
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("categories")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity({
    actorId: user.id,
    actorRole: profile.role,
    action: "category.update",
    entityType: "category",
    entityId: data.id,
    entityLabel: data.name,
    metadata: { slug: data.slug },
  });

  return NextResponse.json(data);
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const { supabase, user, profile, error: authError } = await requireAdminSession();
  if (authError) return authError;

  const { count, error: countError } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Category is used by listings. Reassign or clear those listings first." },
      { status: 409 },
    );
  }

  const { data: category } = await supabase.from("categories").select("name, slug").eq("id", id).maybeSingle();

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity({
    actorId: user.id,
    actorRole: profile.role,
    action: "category.delete",
    entityType: "category",
    entityId: id,
    entityLabel: category?.name ?? null,
    metadata: { slug: category?.slug ?? null },
  });

  return new NextResponse(null, { status: 204 });
}
