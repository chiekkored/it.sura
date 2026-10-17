import type { Category, Listing, ListingInventory, ListingPhoto } from "@/types";

type DemoListing = Listing & {
  listing_photos: ListingPhoto[];
  listing_inventory: ListingInventory[];
};

const createdAt = "2026-10-01T00:00:00.000Z";

export const demoCategories: Category[] = [
  { id: "demo-category-tops", name: "Tops", slug: "tops", created_at: createdAt },
  { id: "demo-category-bottoms", name: "Bottoms", slug: "bottoms", created_at: createdAt },
  { id: "demo-category-accessories", name: "Accessories", slug: "accessories", created_at: createdAt },
];

const photo = (id: string, imageId: string, alt: string): ListingPhoto => ({
  id: `demo-photo-${id}`,
  listing_id: `demo-${id}`,
  image_url: `https://images.unsplash.com/${imageId}?auto=format&fit=crop&w=900&q=85`,
  sort_order: 0,
  alt_text: alt,
  created_at: createdAt,
});

const inventory = (listingId: string, sizes: [string, number][]): ListingInventory[] =>
  sizes.map(([size, quantity], index) => ({
    id: `demo-inventory-${listingId}-${index}`,
    listing_id: `demo-${listingId}`,
    size,
    quantity,
    created_at: createdAt,
    updated_at: createdAt,
  }));

const listing = ({
  id,
  title,
  slug,
  price,
  size,
  description,
  categoryId,
  imageId,
  alt,
  sizes,
}: {
  id: string;
  title: string;
  slug: string;
  price: number;
  size: string | null;
  description: string;
  categoryId: string;
  imageId: string;
  alt: string;
  sizes: [string, number][];
}): DemoListing => ({
  id: `demo-${id}`,
  title,
  slug,
  price,
  size,
  description,
  category_id: categoryId,
  is_active: true,
  created_by: null,
  created_at: createdAt,
  updated_at: createdAt,
  listing_photos: [photo(id, imageId, alt)],
  listing_inventory: inventory(id, sizes),
});

export const demoListings: DemoListing[] = [
  listing({
    id: "linen-shirt",
    title: "Everyday Linen Shirt",
    slug: "everyday-linen-shirt",
    price: 890,
    size: null,
    description: "A relaxed linen blend shirt for warm days and easy layering.",
    categoryId: demoCategories[0].id,
    imageId: "photo-1598033129183-c4f50c736f10",
    alt: "Neutral linen shirt styled for a casual outfit",
    sizes: [["S", 4], ["M", 6], ["L", 3]],
  }),
  listing({
    id: "classic-tee",
    title: "Classic Cotton Tee",
    slug: "classic-cotton-tee",
    price: 490,
    size: null,
    description: "A soft everyday cotton tee with a clean, timeless fit.",
    categoryId: demoCategories[0].id,
    imageId: "photo-1521572163474-6864f9cf17ab",
    alt: "Classic white cotton t-shirt",
    sizes: [["S", 5], ["M", 7], ["L", 4]],
  }),
  listing({
    id: "weekend-denim",
    title: "Weekend Straight Leg Denim",
    slug: "weekend-straight-leg-denim",
    price: 1290,
    size: null,
    description: "Easy straight leg denim made for everyday wear.",
    categoryId: demoCategories[1].id,
    imageId: "photo-1541099649105-f69ad21f3246",
    alt: "Blue straight leg denim jeans",
    sizes: [["26", 2], ["28", 3], ["30", 2], ["32", 1]],
  }),
  listing({
    id: "canvas-tote",
    title: "Market Day Canvas Tote",
    slug: "market-day-canvas-tote",
    price: 350,
    size: "One size",
    description: "A sturdy canvas tote for daily essentials and market finds.",
    categoryId: demoCategories[2].id,
    imageId: "photo-1590874103328-eac38a683ce7",
    alt: "Canvas tote bag styled as an everyday accessory",
    sizes: [["One size", 8]],
  }),
  listing({
    id: "soft-knit-cardigan",
    title: "Soft Knit Cardigan",
    slug: "soft-knit-cardigan",
    price: 1190,
    size: null,
    description: "A lightweight knit layer with a soft feel and easy drape.",
    categoryId: demoCategories[0].id,
    imageId: "photo-1620799140408-edc6dcb6d633",
    alt: "Soft neutral knit cardigan",
    sizes: [["S", 2], ["M", 4], ["L", 2]],
  }),
  listing({
    id: "daily-sneakers",
    title: "Daily Canvas Sneakers",
    slug: "daily-canvas-sneakers",
    price: 990,
    size: null,
    description: "A versatile canvas sneaker designed for comfortable daily wear.",
    categoryId: demoCategories[2].id,
    imageId: "photo-1525966222134-fcfa99b8ae77",
    alt: "Minimal canvas sneakers",
    sizes: [["37", 2], ["38", 3], ["39", 2], ["40", 2]],
  }),
  listing({
    id: "pleated-trousers",
    title: "Relaxed Pleated Trousers",
    slug: "relaxed-pleated-trousers",
    price: 1090,
    size: null,
    description: "Relaxed tailored trousers with a comfortable high rise.",
    categoryId: demoCategories[1].id,
    imageId: "photo-1594633312681-425c7b97ccd1",
    alt: "Relaxed neutral tailored trousers",
    sizes: [["26", 1], ["28", 3], ["30", 3], ["32", 2]],
  }),
  listing({
    id: "woven-crossbody",
    title: "Woven Mini Crossbody",
    slug: "woven-mini-crossbody",
    price: 750,
    size: "One size",
    description: "A compact woven crossbody for the essentials.",
    categoryId: demoCategories[2].id,
    imageId: "photo-1584917865442-de89df76afd3",
    alt: "Woven neutral crossbody bag",
    sizes: [["One size", 0]],
  }),
];
