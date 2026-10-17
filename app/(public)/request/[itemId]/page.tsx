import { notFound } from "next/navigation";
import Image from "next/image";
import { RequestForm } from "@/components/catalog/RequestForm";
import { createClient } from "@/lib/supabase/server";
import type { ListingInventory } from "@/types";
import { demoListings } from "@/lib/demo-catalog";

interface Props {
  params: Promise<{ itemId: string }>;
}

type RequestListing = {
  id: string;
  title: string;
  price: number;
  listing_photos: { image_url: string }[];
  listing_inventory: Pick<ListingInventory, "id" | "size" | "quantity">[];
};

export default async function RequestPage({ params }: Props) {
  const { itemId } = await params;
  const demoMode = process.env.NEXT_PUBLIC_CATALOG_DEMO === "true";
  let requestListing: RequestListing | null;

  if (demoMode) {
    const demoListing = demoListings.find((item) => item.id === itemId && item.is_active);
    requestListing = demoListing
      ? {
          id: demoListing.id,
          title: demoListing.title,
          price: demoListing.price,
          listing_photos: demoListing.listing_photos,
          listing_inventory: demoListing.listing_inventory,
        }
      : null;
  } else {
    const supabase = await createClient();
    const { data: listing } = await supabase
      .from("listings")
      .select(`
        id,
        title,
        price,
        listing_photos (
          image_url
        ),
        listing_inventory (
          id,
          size,
          quantity
        )
      `)
      .eq("id", itemId)
      .eq("is_active", true)
      .single();
    requestListing = listing as RequestListing | null;
  }

  if (!requestListing) notFound();

  const primaryPhoto = requestListing.listing_photos?.[0]?.image_url;
  const inventory = requestListing.listing_inventory ?? [];

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Request to Buy</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {demoMode
            ? "Preview the request form. Submissions are not sent or saved."
            : "Fill in your details and we&apos;ll get back to you."}
        </p>
      </div>

      <div className="mb-6 p-4 rounded-xl border bg-card flex gap-4 items-center">
        {primaryPhoto && (
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border">
            <Image
              src={primaryPhoto}
              alt={requestListing.title}
              fill
              className="object-cover"
              sizes="80px"
            />
          </div>
        )}
        <div>
          <p className="font-medium">{requestListing.title}</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            ₱{requestListing.price.toLocaleString()}
          </p>
        </div>
      </div>

      <RequestForm listingId={requestListing.id} inventory={inventory} demoMode={demoMode} />
    </div>
  );
}
