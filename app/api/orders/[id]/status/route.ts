import { NextResponse } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/activity-logs";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

const statusSchema = z.object({
  status: z.enum(["new", "contacted", "pending_payment", "completed", "cancelled"]),
});

type StatusUpdateResult = {
  order?: {
    request_code?: string;
  };
  previous_status?: string;
  next_status?: string;
  inventory_delta?: number;
  remaining_quantity?: number | null;
  auto_cancelled_orders?: Json[];
  auto_cancelled_count?: number;
};

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

  const { data, error } = await supabase.rpc("update_order_status_with_inventory", {
    p_order_id: id,
    p_status: parsed.data.status,
  });

  if (error) {
    const status = error.code === "42501" ? 403 : ["22003", "22023", "P0002"].includes(error.code) ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  const result = data as StatusUpdateResult;

  await logActivity({
    actorId: user.id,
    actorRole: profile.role,
    action: "order.status_update",
    entityType: "order_request",
    entityId: id,
    entityLabel: result.order?.request_code ?? null,
    metadata: {
      previous_status: result.previous_status,
      next_status: result.next_status,
      inventory_delta: result.inventory_delta,
      remaining_quantity: result.remaining_quantity,
      auto_cancelled_orders: result.auto_cancelled_orders ?? [],
      auto_cancelled_count: result.auto_cancelled_count ?? 0,
    },
  });

  return NextResponse.json(result);
}
