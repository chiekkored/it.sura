import { createClient } from "@/lib/supabase/server";
import { CatalogShell } from "@/components/catalog/CatalogShell";
import type { Listing, ListingPhoto, Category } from "@/types";
import { demoCategories, demoListings } from "@/lib/demo-catalog";

export const metadata = {
  title: "Shop — Browse Catalog",
  description: "Browse our catalog and request items.",
};

export default async function CatalogPage() {
  if (process.env.NEXT_PUBLIC_CATALOG_DEMO === "true") {
    return <CatalogShell listings={demoListings} categories={demoCategories} />;
  }

  const supabase = await createClient();

  const [{ data: listingsRaw }, { data: categories }] = await Promise.all([
    supabase
      .from("listings")
      .select("*, listing_photos(*), listing_inventory(*)")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("*").order("name"),
  ]);

  const listings = (listingsRaw ?? []) as unknown as (Listing & { 
    listing_photos: ListingPhoto[];
    listing_inventory: { quantity: number }[];
  })[];

  return (
    <CatalogShell
      listings={listings}
      categories={(categories ?? []) as Category[]}
    />
  );
}
