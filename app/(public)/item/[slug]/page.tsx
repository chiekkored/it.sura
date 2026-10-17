import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ImageCarousel } from "@/components/catalog/ImageCarousel";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import type { Listing, ListingPhoto, Category, ListingInventory } from "@/types";
import { demoCategories, demoListings } from "@/lib/demo-catalog";

type ListingFull = Listing & {
  listing_photos: ListingPhoto[];
  listing_inventory: ListingInventory[];
  categories: Category | null;
};

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (process.env.NEXT_PUBLIC_CATALOG_DEMO === "true") {
    const listing = demoListings.find((item) => item.slug === slug);
    if (!listing) return { title: "Item Not Found" };
    return {
      title: `${listing.title} — Shop`,
      description: listing.description ?? undefined,
    };
  }

  const supabase = await createClient();
  const { data } = await supabase.from("listings").select("title, description").eq("slug", slug).single();

  if (!data) return { title: "Item Not Found" };

  return {
    title: `${data.title} — Shop`,
    description: data.description ?? undefined,
  };
}

export default async function ItemPage({ params }: Props) {
  const { slug } = await params;
  const demoMode = process.env.NEXT_PUBLIC_CATALOG_DEMO === "true";
  let listing: ListingFull | null;

  if (demoMode) {
    const demoListing = demoListings.find((item) => item.slug === slug && item.is_active);
    listing = demoListing
      ? {
          ...demoListing,
          categories: demoCategories.find((category) => category.id === demoListing.category_id) ?? null,
        }
      : null;
  } else {
    const supabase = await createClient();
    const { data: listingRaw } = await supabase
      .from("listings")
      .select("*, listing_photos(*), listing_inventory(*), categories(*)")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();
    listing = listingRaw as unknown as ListingFull | null;
  }

  if (!listing) notFound();

  const photos = [...(listing.listing_photos ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  const totalQuantity = listing.listing_inventory?.reduce((acc, item) => acc + item.quantity, 0) ?? 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <ImageCarousel photos={photos} title={listing.title} />

        <div className="space-y-6">
          <div className="space-y-2">
            {listing.categories && <Badge variant="outline">{listing.categories.name}</Badge>}
            <h1 className="text-2xl font-semibold leading-tight">{listing.title}</h1>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold">₱{listing.price.toLocaleString()}</span>
              {totalQuantity === 0 && <Badge variant="destructive">Sold Out</Badge>}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Available Sizes</Label>
            <div className="flex flex-wrap gap-2">
              {listing.listing_inventory?.length > 0 ? (
                listing.listing_inventory.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "px-3 py-1.5 rounded-md border text-sm flex flex-col items-center",
                      item.quantity === 0 ? "opacity-50 bg-muted" : "bg-card",
                    )}
                  >
                    <span className="font-bold">{item.size}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {item.quantity === 0 ? "Out of Stock" : `${item.quantity} Left`}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic">No sizes specified.</p>
              )}
            </div>
          </div>

          {listing.description && (
            <div className="space-y-2 pt-2">
              <Label className="text-sm font-semibold">Description</Label>
              <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">{listing.description}</p>
            </div>
          )}

          {/* Sticky CTA on mobile */}
          <div className="hidden md:block pt-4">
            <Button asChild size="lg" className="w-full" disabled={totalQuantity === 0}>
              <Link href={totalQuantity === 0 ? "#" : `/request/${listing.id}`}>
                {totalQuantity === 0 ? "Currently Out of Stock" : "Request to Buy"}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t z-10">
        <Button asChild size="lg" className="w-full" disabled={totalQuantity === 0}>
          <Link href={totalQuantity === 0 ? "#" : `/request/${listing.id}`}>
            {totalQuantity === 0 ? "Currently Out of Stock" : "Request to Buy"}
          </Link>
        </Button>
      </div>
      {/* Spacer so content isn't hidden behind the sticky button on mobile */}
      <div className="md:hidden h-20" />
    </div>
  );
}
