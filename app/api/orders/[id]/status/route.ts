import { NextResponse } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/activity-logs";
import { createClient } from "@/lib/supabase/server";

const statusSchema = z.object({
  status: z.enum(["new", "contacted", "pending_payment", "closed", "cancelled"]),
});

interface Context {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["superadmin", "admin", "staff"].includes(profile.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabase
    .from("order_requests")
    .select("request_code, status")
    .eq("id", id)
    .single();

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });

  const { data, error } = await supabase
    .from("order_requests")
    .update({ status: parsed.data.status })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity({
    actorId: user.id,
    actorRole: profile.role,
    action: "order.status_update",
    entityType: "order_request",
    entityId: id,
    entityLabel: order.request_code,
    metadata: {
      previous_status: order.status,
      next_status: parsed.data.status,
    },
  });

  return NextResponse.json(data);
}
