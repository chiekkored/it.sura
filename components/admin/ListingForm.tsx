"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listingSchema, type ListingFormValues } from "@/lib/validators/listing";
import { PhotoUploader } from "./PhotoUploader";
import { Plus, Trash2, Upload } from "lucide-react";
import type { Category, Listing, ListingPhoto, ListingInventory } from "@/types";

type ListingWithMedia = Listing & {
  listing_photos: ListingPhoto[];
  listing_inventory: ListingInventory[];
};

type PendingPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

interface ListingFormProps {
  categories: Category[];
  listing?: ListingWithMedia;
  onCreated?: () => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
  onSuccess?: () => void;
  formId?: string;
}

export function ListingForm({
  categories,
  listing,
  onCreated,
  onSubmittingChange,
  onSuccess,
  formId,
}: ListingFormProps) {
  const router = useRouter();
  const hasCategories = categories.length > 0;
  const pendingPhotoInputRef = useRef<HTMLInputElement>(null);
  const pendingPhotosRef = useRef<PendingPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createdListing, setCreatedListing] = useState<ListingWithMedia | null>(null);
  const [photos, setPhotos] = useState<ListingPhoto[]>(listing?.listing_photos ?? []);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPendingPhotos, setIsUploadingPendingPhotos] = useState(false);
  const activeListing = listing ?? createdListing;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema) as Resolver<ListingFormValues>,
    defaultValues: listing
      ? {
          title: listing.title,
          slug: listing.slug,
          price: listing.price,
          size: listing.size ?? "",
          inventory: listing.listing_inventory.map(item => ({
            size: item.size,
            quantity: item.quantity
          })),
          description: listing.description ?? "",
          category_id: listing.category_id ?? "",
          is_active: listing.is_active,
        }
      : { category_id: "", is_active: true, price: 0, size: "", inventory: [] },
  });

  const inventory = watch("inventory") || [];
  const categoryId = watch("category_id");
  const setInventory = (nextInventory: ListingFormValues["inventory"]) => {
    setValue("inventory", nextInventory, { shouldDirty: true, shouldValidate: true });
  };

  useEffect(() => {
    register("category_id");
  }, [register]);

  useEffect(() => {
    pendingPhotosRef.current = pendingPhotos;
  }, [pendingPhotos]);

  useEffect(() => {
    return () => {
      pendingPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, []);

  const addInventoryItem = () => {
    setInventory([...inventory, { size: "", quantity: 1 }]);
  };

  const removeInventoryItem = (index: number) => {
    setInventory(inventory.filter((_, i) => i !== index));
  };

  const autoSlug = (title: string) =>
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");

  const handlePendingPhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    setPendingPhotos((currentPhotos) => [
      ...currentPhotos,
      ...files.map((file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);

    if (event.target) event.target.value = "";
  };

  const removePendingPhoto = (photoId: string) => {
    setPendingPhotos((currentPhotos) => {
      const photoToRemove = currentPhotos.find((photo) => photo.id === photoId);
      if (photoToRemove) URL.revokeObjectURL(photoToRemove.previewUrl);
      return currentPhotos.filter((photo) => photo.id !== photoId);
    });
  };

  const uploadPendingPhotos = async (listingId: string) => {
    if (!pendingPhotos.length) return [];

    setIsUploadingPendingPhotos(true);
    const uploadedPhotos: ListingPhoto[] = [];

    try {
      for (const pendingPhoto of pendingPhotos) {
        const formData = new FormData();
        formData.append("file", pendingPhoto.file);
        formData.append("listing_id", listingId);

        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();

        if (!uploadRes.ok) {
          throw new Error(uploadData.error ?? "Photo upload failed.");
        }

        uploadedPhotos.push(uploadData.photo as ListingPhoto);
      }

      pendingPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      setPendingPhotos([]);
      return uploadedPhotos;
    } finally {
      setIsUploadingPendingPhotos(false);
    }
  };

  const onSubmit = async (values: ListingFormValues) => {
    setError(null);
    setIsSaving(true);
    onSubmittingChange?.(true);

    const url = activeListing ? `/api/listings/${activeListing.id}` : "/api/listings";
    const method = activeListing ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save listing.");
        return;
      }

      const savedListing = (await res.json()) as Listing;

      if (!activeListing) {
        const newListing: ListingWithMedia = {
          ...savedListing,
          listing_photos: [],
          listing_inventory: [],
        };

        setCreatedListing(newListing);
        setPhotos([]);
        onCreated?.();

        let uploadedPhotos: ListingPhoto[] = [];

        try {
          uploadedPhotos = await uploadPendingPhotos(savedListing.id);
        } catch (err) {
          pendingPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
          setPendingPhotos([]);
          throw err;
        }

        setCreatedListing({
          ...newListing,
          listing_photos: uploadedPhotos,
        });
        setPhotos(uploadedPhotos);
      }

      onSuccess?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save listing.");
    } finally {
      setIsSaving(false);
      onSubmittingChange?.(false);
    }
  };

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          {...register("title")}
          onChange={(e) => {
            register("title").onChange(e);
            if (!activeListing) setValue("slug", autoSlug(e.target.value));
          }}
        />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="slug">Slug *</Label>
        <Input id="slug" {...register("slug")} />
        {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="price">Price (₱) *</Label>
          <Input id="price" type="number" step="0.01" min="0" {...register("price")} />
          {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
        </div>
      </div>

      <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Inventory</Label>
          <Button type="button" variant="outline" size="sm" onClick={addInventoryItem} disabled={isSaving}>
            <Plus className="h-4 w-4 mr-1" /> Add Size
          </Button>
        </div>

        {!inventory.length && (
          <p className="text-xs text-muted-foreground italic">No sizes added yet. At least one size is recommended.</p>
        )}

        {inventory.map((item, index) => (
          <div key={index} className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-[10px] uppercase">Size</Label>
              <Select 
                value={item.size} 
                onValueChange={(val) => {
                  const newInventory = [...inventory];
                  newInventory[index].size = val;
                  setInventory(newInventory);
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="XS">XS</SelectItem>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="M">M</SelectItem>
                  <SelectItem value="L">L</SelectItem>
                  <SelectItem value="XL">XL</SelectItem>
                  <SelectItem value="XXL">XXL</SelectItem>
                  <SelectItem value="Free Size">Free Size</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-24 space-y-1">
              <Label className="text-[10px] uppercase">Qty</Label>
              <Input 
                type="number" 
                min="0" 
                className="h-9"
                value={item.quantity}
                onChange={(e) => {
                  const newInventory = [...inventory];
                  newInventory[index].quantity = parseInt(e.target.value) || 0;
                  setInventory(newInventory);
                }}
              />
            </div>
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 text-destructive"
              onClick={() => removeInventoryItem(index)}
              disabled={isSaving}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {errors.inventory && <p className="text-xs text-destructive">{errors.inventory.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="category_id">Category *</Label>
        <Select
          value={categoryId}
          onValueChange={(val) => setValue("category_id", val, { shouldDirty: true, shouldValidate: true })}
          disabled={!hasCategories || isSaving}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={hasCategories ? "Select category" : "Create a category first"} />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!hasCategories && (
          <p className="text-xs text-destructive">Create at least one category before saving a listing.</p>
        )}
        {errors.category_id && <p className="text-xs text-destructive">{errors.category_id.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" {...register("description")} rows={4} />
      </div>

      <div className="flex items-center gap-2">
        <input id="is_active" type="checkbox" {...register("is_active")} className="h-4 w-4" />
        <Label htmlFor="is_active">Active (visible to buyers)</Label>
      </div>

      <div className="space-y-1.5">
        <Label>Photos</Label>
        {activeListing ? (
          <PhotoUploader listingId={activeListing.id} photos={photos} onPhotosChange={setPhotos} />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              {pendingPhotos.map((photo) => (
                <div key={photo.id} className="relative h-20 w-20 overflow-hidden rounded border">
                  <Image src={photo.previewUrl} alt="Pending photo" fill className="object-cover" sizes="80px" />
                  <button
                    type="button"
                    onClick={() => removePendingPhoto(photo.id)}
                    disabled={isSaving || isUploadingPendingPhotos}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
            <input
              ref={pendingPhotoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePendingPhotoSelect}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => pendingPhotoInputRef.current?.click()}
              disabled={isSaving || isUploadingPendingPhotos}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploadingPendingPhotos ? "Uploading..." : "Upload Photos"}
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
