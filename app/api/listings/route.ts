import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-logs";
import { listingSchema } from "@/lib/validators/listing";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = listingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message },
      { status: 400 }
    );
  }

  const { category_id, size, inventory, description, ...rest } = parsed.data;

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .insert({
      ...rest,
      category_id: category_id || null,
      size: size || null,
      description: description || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (listingError) {
    return NextResponse.json({ error: listingError.message }, { status: 500 });
  }

  if (inventory && inventory.length > 0) {
    const inventoryData = inventory.map(item => ({
      listing_id: listing.id,
      size: item.size,
      quantity: item.quantity,
    }));

    const { error: inventoryError } = await supabase
      .from("listing_inventory")
      .insert(inventoryData);

    if (inventoryError) {
      await supabase.from("listings").delete().eq("id", listing.id);
      return NextResponse.json({ error: inventoryError.message }, { status: 500 });
    }
  }

  await logActivity({
    actorId: user.id,
    action: "listing.create",
    entityType: "listing",
    entityId: listing.id,
    entityLabel: listing.title,
    metadata: {
      slug: listing.slug,
      price: listing.price,
      inventory_count: inventory?.length ?? 0,
    },
  });

  return NextResponse.json(listing, { status: 201 });
}
