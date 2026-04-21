import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-logs";
import { listingSchema } from "@/lib/validators/listing";
import type { Json } from "@/types/database";

interface Context {
  params: Promise<{ id: string }>;
}

type InventoryChangeItem = {
  size: string;
  quantity: number;
};

type ListingChange = {
  field: string;
  label: string;
  previous: Json;
  next: Json;
};

function normalizeText(value: string | null | undefined) {
  return value || null;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "active" : "inactive";
  if (Array.isArray(value)) {
    if (!value.length) return "none";
    return value
      .map((item) => {
        if (typeof item === "object" && item && "size" in item && "quantity" in item) {
          const inventoryItem = item as InventoryChangeItem;
          return `${inventoryItem.size}: ${inventoryItem.quantity}`;
        }
        return String(item);
      })
      .join(", ");
  }
  return String(value);
}

function normalizeInventory(items: InventoryChangeItem[] = []) {
  return items
    .map((item) => ({ size: item.size, quantity: item.quantity }))
    .sort((a, b) => a.size.localeCompare(b.size));
}

function valuesMatch(previous: unknown, next: unknown) {
  return JSON.stringify(previous) === JSON.stringify(next);
}

function addChange(changes: ListingChange[], field: string, label: string, previous: Json, next: Json) {
  if (valuesMatch(previous, next)) return;
  changes.push({ field, label, previous, next });
}

function buildListingUpdateMetadata(changes: ListingChange[]) {
  const summary = changes.length
    ? changes.map((change) => `${change.label} changed from ${formatValue(change.previous)} to ${formatValue(change.next)}`).join("; ")
    : "No visible listing fields changed";

  return {
    summary,
    changed_fields: changes.map((change) => change.field),
    changes,
  };
}

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
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
  const { data: previousListing, error: previousListingError } = await supabase
    .from("listings")
    .select("title, slug, price, size, description, category_id, is_active")
    .eq("id", id)
    .single();

  if (previousListingError) return NextResponse.json({ error: previousListingError.message }, { status: 500 });

  const { data: previousInventory, error: previousInventoryError } = await supabase
    .from("listing_inventory")
    .select("size, quantity")
    .eq("listing_id", id);

  if (previousInventoryError) return NextResponse.json({ error: previousInventoryError.message }, { status: 500 });

  const { data, error } = await supabase
    .from("listings")
    .update({
      ...rest,
      category_id: category_id || null,
      size: size || null,
      description: description || null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sync inventory
  if (inventory) {
    // Simple sync: delete existing and re-insert (for simplicity in this flow)
    const { error: deleteInventoryError } = await supabase.from("listing_inventory").delete().eq("listing_id", id);
    if (deleteInventoryError) {
      return NextResponse.json({ error: deleteInventoryError.message }, { status: 500 });
    }
    
    if (inventory.length > 0) {
      const inventoryData = inventory.map(item => ({
        listing_id: id,
        size: item.size,
        quantity: item.quantity,
      }));

      const { error: inventoryError } = await supabase
        .from("listing_inventory")
        .insert(inventoryData);

      if (inventoryError) {
        return NextResponse.json({ error: inventoryError.message }, { status: 500 });
      }
    }
  }

  const previousInventorySummary = normalizeInventory(previousInventory ?? []);
  const nextInventorySummary = normalizeInventory(inventory ?? []);
  const changes: ListingChange[] = [];

  addChange(changes, "title", "Title", previousListing.title, data.title);
  addChange(changes, "slug", "Slug", previousListing.slug, data.slug);
  addChange(changes, "price", "Price", previousListing.price, data.price);
  addChange(changes, "size", "Size", normalizeText(previousListing.size), normalizeText(data.size));
  addChange(
    changes,
    "description",
    "Description",
    normalizeText(previousListing.description),
    normalizeText(data.description),
  );
  addChange(changes, "category_id", "Category", previousListing.category_id, data.category_id);
  addChange(changes, "is_active", "Status", previousListing.is_active, data.is_active);
  addChange(changes, "inventory", "Inventory", previousInventorySummary, nextInventorySummary);

  await logActivity({
    actorId: user.id,
    action: "listing.update",
    entityType: "listing",
    entityId: data.id,
    entityLabel: data.title,
    metadata: buildListingUpdateMetadata(changes),
  });

  return NextResponse.json(data);
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: listing } = await supabase.from("listings").select("title, slug").eq("id", id).maybeSingle();

  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity({
    actorId: user.id,
    action: "listing.delete",
    entityType: "listing",
    entityId: id,
    entityLabel: listing?.title ?? null,
    metadata: { slug: listing?.slug ?? null },
  });

  return new NextResponse(null, { status: 204 });
}
