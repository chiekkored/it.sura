import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-logs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const listing_id = formData.get("listing_id") as string | null;

  if (!file || !listing_id) {
    return NextResponse.json({ error: "Missing file or listing_id" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${listing_id}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("listing-images")
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage
    .from("listing-images")
    .getPublicUrl(path);

  const { data: photo, error: dbError } = await supabase
    .from("listing_photos")
    .insert({ listing_id, image_url: publicUrl, sort_order: 0 })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  await logActivity({
    actorId: user.id,
    action: "listing_photo.upload",
    entityType: "listing_photo",
    entityId: photo.id,
    entityLabel: file.name,
    metadata: {
      listing_id,
      image_url: publicUrl,
    },
  });

  return NextResponse.json({ photo }, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const photoId = searchParams.get("id");

  if (!photoId) {
    return NextResponse.json({ error: "Missing photo id" }, { status: 400 });
  }

  const { data: photo, error: photoError } = await supabase
    .from("listing_photos")
    .select("id, listing_id, image_url, alt_text")
    .eq("id", photoId)
    .single();

  if (photoError) return NextResponse.json({ error: photoError.message }, { status: 500 });

  const path = new URL(photo.image_url).pathname.split("/object/public/")[1];
  const storagePath = path?.replace("listing-images/", "");

  if (storagePath) {
    const { error: storageError } = await supabase.storage.from("listing-images").remove([storagePath]);
    if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  const { error: deleteError } = await supabase.from("listing_photos").delete().eq("id", photo.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  await logActivity({
    actorId: user.id,
    action: "listing_photo.delete",
    entityType: "listing_photo",
    entityId: photo.id,
    entityLabel: photo.alt_text,
    metadata: {
      listing_id: photo.listing_id,
      image_url: photo.image_url,
    },
  });

  return new NextResponse(null, { status: 204 });
}
