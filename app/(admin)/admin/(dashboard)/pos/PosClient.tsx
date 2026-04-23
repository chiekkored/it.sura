"use client";

import Image from "next/image";
import { Minus, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn } from "@/lib/utils";
import type { Category, Listing, ListingInventory, ListingPhoto, SalePaymentMethod } from "@/types";

type ListingForPos = Listing & {
  listing_photos: ListingPhoto[];
  listing_inventory: ListingInventory[];
};

type PosTile = {
  key: string;
  listingId: string;
  categoryId: string | null;
  title: string;
  slug: string;
  price: number;
  size: string;
  stock: number;
  imageUrl: string | null;
  imageAlt: string | null;
};

type CartItem = PosTile & {
  quantity: number;
};

const paymentMethods: { value: SalePaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

function formatMoney(value: number) {
  return `₱${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function toTiles(listings: ListingForPos[]): PosTile[] {
  return listings.flatMap((listing) => {
    const photo = [...(listing.listing_photos ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];

    return [...(listing.listing_inventory ?? [])]
      .sort((a, b) => a.size.localeCompare(b.size))
      .map((inventory) => ({
        key: `${listing.id}:${inventory.size}`,
        listingId: listing.id,
        categoryId: listing.category_id,
        title: listing.title,
        slug: listing.slug,
        price: listing.price,
        size: inventory.size,
        stock: inventory.quantity,
        imageUrl: photo?.image_url ?? null,
        imageAlt: photo?.alt_text ?? listing.title,
      }));
  });
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(target.closest("input, textarea, select, button, [contenteditable='true']"));
}

export function PosClient() {
  const [tiles, setTiles] = useState<PosTile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebouncedValue(search);

  const loadCatalog = useCallback(async (searchTerm = "", categoryId: string | null = null) => {
    setIsLoading(true);
    const supabase = createClient();
    const normalizedSearch = searchTerm.trim();
    let matchingListingIds: string[] = [];

    if (normalizedSearch) {
      const { data: matchingInventory } = await supabase
        .from("listing_inventory")
        .select("listing_id")
        .ilike("size", `%${normalizedSearch}%`);

      matchingListingIds = Array.from(new Set(matchingInventory?.map((item) => item.listing_id) ?? []));
    }

    let listingsQuery = supabase
      .from("listings")
      .select("*, listing_photos(*), listing_inventory(*)")
      .eq("is_active", true)
      .order("title");

    if (categoryId) {
      listingsQuery = listingsQuery.eq("category_id", categoryId);
    }

    if (normalizedSearch) {
      const escapedSearch = normalizedSearch.replaceAll(",", "\\,");
      const filters = [`title.ilike.%${escapedSearch}%`, `slug.ilike.%${escapedSearch}%`];

      if (matchingListingIds.length) {
        filters.push(`id.in.(${matchingListingIds.join(",")})`);
      }

      listingsQuery = listingsQuery.or(filters.join(","));
    }

    const { data, error } = await listingsQuery;

    if (error) {
      toast.error(error.message);
      setTiles([]);
      setIsLoading(false);
      return;
    }

    setTiles(toTiles((data ?? []) as ListingForPos[]));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let isCurrent = true;

    const loadInitialCatalog = async () => {
      const supabase = createClient();
      const normalizedSearch = debouncedSearch.trim();
      let matchingListingIds: string[] = [];

      if (normalizedSearch) {
        const { data: matchingInventory } = await supabase
          .from("listing_inventory")
          .select("listing_id")
          .ilike("size", `%${normalizedSearch}%`);

        matchingListingIds = Array.from(new Set(matchingInventory?.map((item) => item.listing_id) ?? []));
      }

      const categoriesQuery = supabase.from("categories").select("*").order("name");
      let listingsQuery = supabase.from("listings").select("*, listing_photos(*), listing_inventory(*)").eq("is_active", true);

      if (activeCategory) {
        listingsQuery = listingsQuery.eq("category_id", activeCategory);
      }

      listingsQuery = listingsQuery.order("title");

      if (normalizedSearch) {
        const escapedSearch = normalizedSearch.replaceAll(",", "\\,");
        const filters = [`title.ilike.%${escapedSearch}%`, `slug.ilike.%${escapedSearch}%`];

        if (matchingListingIds.length) {
          filters.push(`id.in.(${matchingListingIds.join(",")})`);
        }

        listingsQuery = listingsQuery.or(filters.join(","));
      }

      const [{ data, error }, { data: categoriesData, error: categoriesError }] = await Promise.all([
        listingsQuery,
        categoriesQuery,
      ]);

      if (!isCurrent) return;

      if (error || categoriesError) {
        toast.error(error?.message ?? categoriesError?.message ?? "Failed to load POS catalog");
        setTiles([]);
        setIsLoading(false);
        return;
      }

      setTiles(toTiles((data ?? []) as ListingForPos[]));
      setCategories((categoriesData ?? []) as Category[]);
      setIsLoading(false);
    };

    loadInitialCatalog();

    return () => {
      isCurrent = false;
    };
  }, [activeCategory, debouncedSearch]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.length !== 1) return;
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      searchInputRef.current?.focus();
      setSearch((current) => `${current}${event.key}`);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const paid = Number(amountPaid) || 0;
  const changeDue = Math.max(0, paid - subtotal);

  const addToCart = (tile: PosTile) => {
    if (tile.stock <= 0) {
      toast.error("This size is out of stock");
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.key === tile.key);
      if (!existing) return [...current, { ...tile, quantity: 1 }];

      if (existing.quantity >= tile.stock) {
        toast.error("No more stock available for this size");
        return current;
      }

      return current.map((item) => (item.key === tile.key ? { ...item, quantity: item.quantity + 1 } : item));
    });
  };

  const updateQuantity = (key: string, quantity: number) => {
    setCart((current) =>
      current.flatMap((item) => {
        if (item.key !== key) return [item];
        if (quantity < 1) return [];
        return [{ ...item, quantity: Math.min(quantity, item.stock) }];
      }),
    );
  };

  const handleCheckout = async () => {
    if (!cart.length) {
      toast.error("Add at least one item");
      return;
    }

    if (paid < subtotal) {
      toast.error("Amount paid is less than the total");
      return;
    }

    setIsCheckingOut(true);
    const response = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map((item) => ({
          listing_id: item.listingId,
          size: item.size,
          quantity: item.quantity,
        })),
        payment_method: paymentMethod,
        amount_paid: paid,
      }),
    });

    const result = (await response.json()) as { error?: string; sale?: { sale_number?: string } };
    setIsCheckingOut(false);

    if (!response.ok) {
      toast.error(result.error ?? "Checkout failed");
      return;
    }

    toast.success(`Sale ${result.sale?.sale_number ?? ""} completed`.trim());
    setCart([]);
    setAmountPaid("");
    await loadCatalog(debouncedSearch, activeCategory);
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-6.5rem)] flex-col gap-4 xl:flex-row">
      <section className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Point of Sale</h1>
            <p className="text-sm text-muted-foreground">Select an item-size tile to add it to the sale.</p>
          </div>
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search items or sizes..."
              className="pl-8"
              aria-label="Search POS items"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              !activeCategory
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-foreground hover:border-foreground",
            )}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                activeCategory === category.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:border-foreground",
              )}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {isLoading
            ? Array.from({ length: 10 }).map((_, index) => <Skeleton key={index} className="aspect-[4/5] rounded-lg" />)
            : tiles.map((tile) => (
                <button
                  key={tile.key}
                  type="button"
                  onClick={() => addToCart(tile)}
                  disabled={tile.stock <= 0}
                  className="group overflow-hidden rounded-lg border bg-white text-left transition hover:border-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="relative aspect-square bg-muted">
                    {tile.imageUrl ? (
                      <Image
                        src={tile.imageUrl}
                        alt={tile.imageAlt ?? tile.title}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No image</div>
                    )}
                    <Badge className="absolute left-2 top-2">Size {tile.size}</Badge>
                  </div>
                  <div className="space-y-2 p-3">
                    <p className="line-clamp-2 min-h-10 text-sm font-medium leading-tight">{tile.title}</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{formatMoney(tile.price)}</span>
                      <span className="text-xs text-muted-foreground">{tile.stock} left</span>
                    </div>
                  </div>
                </button>
              ))}
        </div>

        {!isLoading && !tiles.length && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No available item sizes match your search.
          </div>
        )}
      </section>

      <aside className="flex w-full flex-col rounded-lg border bg-white xl:w-[380px]">
        <div className="flex items-center gap-2 border-b p-4">
          <ShoppingCart className="h-5 w-5" />
          <h2 className="font-semibold">Current Sale</h2>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {cart.length ? (
            cart.map((item) => (
              <div key={item.key} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="relative h-14 w-14 flex-none overflow-hidden rounded-md bg-muted">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.imageAlt ?? item.title}
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-1 text-center text-[10px] text-muted-foreground">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Size {item.size} · {formatMoney(item.price)}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => updateQuantity(item.key, 0)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon-sm" onClick={() => updateQuantity(item.key, item.quantity - 1)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <Button variant="outline" size="icon-sm" onClick={() => updateQuantity(item.key, item.quantity + 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <span className="text-sm font-semibold">{formatMoney(item.price * item.quantity)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No items added yet.
            </div>
          )}
        </div>

        <div className="space-y-4 border-t p-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as SalePaymentMethod)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="amount-paid">Amount Paid</Label>
              <Input
                id="amount-paid"
                type="number"
                min="0"
                step="0.01"
                value={amountPaid}
                onChange={(event) => setAmountPaid(event.target.value)}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Change</span>
              <span className="font-medium">{formatMoney(changeDue)}</span>
            </div>
          </div>

          <Button className="w-full" onClick={handleCheckout} disabled={isCheckingOut || !cart.length}>
            {isCheckingOut ? "Completing..." : "Complete Sale"}
          </Button>
        </div>
      </aside>
    </div>
  );
}
