import { NextResponse } from "next/server";
import { adminPosSalesEnabled } from "@/flags";
import { logActivity } from "@/lib/activity-logs";
import { createClient } from "@/lib/supabase/server";
import { createSaleSchema } from "@/lib/validators/sale";
import type { Json } from "@/types/database";

type CreateSaleResult = {
  sale?: {
    id?: string;
    sale_number?: string;
    total?: number;
    payment_method?: string;
  };
  items?: Json[];
};

function getRpcStatus(code?: string) {
  if (code === "42501") return 403;
  if (code && ["22003", "22023", "P0002"].includes(code)) return 400;
  return 500;
}

export async function POST(request: Request) {
  if (!(await adminPosSalesEnabled())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSaleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("create_pos_sale", {
    p_items: parsed.data.items,
    p_payment_method: parsed.data.payment_method,
    p_amount_paid: parsed.data.amount_paid,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: getRpcStatus(error.code) });
  }

  const result = data as CreateSaleResult;

  await logActivity({
    actorId: user.id,
    action: "sale.create",
    entityType: "sale",
    entityId: result.sale?.id ?? null,
    entityLabel: result.sale?.sale_number ?? null,
    metadata: {
      total: result.sale?.total,
      payment_method: result.sale?.payment_method,
      item_count: result.items?.length ?? 0,
    },
  });

  return NextResponse.json(result, { status: 201 });
}
