import { NextResponse } from "next/server";
import { adminPosSalesEnabled } from "@/flags";
import { logActivity } from "@/lib/activity-logs";
import { createClient } from "@/lib/supabase/server";

type VoidSaleResult = {
  sale?: {
    id?: string;
    sale_number?: string;
    total?: number;
    status?: string;
  };
};

interface Context {
  params: Promise<{ id: string }>;
}

function getRpcStatus(code?: string) {
  if (code === "42501") return 403;
  if (code && ["22003", "22023", "P0002"].includes(code)) return 400;
  return 500;
}

export async function PUT(_request: Request, { params }: Context) {
  if (!(await adminPosSalesEnabled())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("void_pos_sale", {
    p_sale_id: id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: getRpcStatus(error.code) });
  }

  const result = data as VoidSaleResult;

  await logActivity({
    actorId: user.id,
    action: "sale.void",
    entityType: "sale",
    entityId: result.sale?.id ?? id,
    entityLabel: result.sale?.sale_number ?? null,
    metadata: {
      total: result.sale?.total,
      status: result.sale?.status,
    },
  });

  return NextResponse.json(result);
}
