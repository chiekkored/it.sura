"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ListingPhoto } from "@/types";

interface PhotoUploaderProps {
  listingId: string;
  photos: ListingPhoto[];
  onPhotosChange: (photos: ListingPhoto[]) => void;
}

export function PhotoUploader({
  listingId,
  photos,
  onPhotosChange,
}: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setUploading(true);
    setError(null);

    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("listing_id", listingId);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        break;
      }

      onPhotosChange([...photos, data.photo]);
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDelete = async (photo: ListingPhoto) => {
    const res = await fetch(`/api/upload?id=${photo.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Delete failed");
      return;
    }

    onPhotosChange(photos.filter((p) => p.id !== photo.id));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {photos.map((photo) => (
          <div key={photo.id} className="relative group w-20 h-20">
            <Image
              src={photo.image_url}
              alt={photo.alt_text ?? "Photo"}
              fill
              className="object-cover rounded border"
              sizes="80px"
            />
            <button
              type="button"
              onClick={() => handleDelete(photo)}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 rounded flex items-center justify-center transition-opacity"
            >
              <Trash2 className="h-4 w-4 text-white" />
            </button>
          </div>
        ))}
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Uploading..." : "Upload Photos"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
