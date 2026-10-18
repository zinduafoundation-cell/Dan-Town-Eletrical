import { NextResponse } from "next/server";
import { z } from "zod";
import type { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bucketName = "product-images";
const maxFileSize = 6 * 1024 * 1024;
const categoryIdSchema = z.string().uuid();
const imageTypes = {
  "image/jpeg": {
    extension: "jpg",
    signature: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  "image/png": {
    extension: "png",
    signature: (bytes: Uint8Array) => bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10",
  },
  "image/webp": {
    extension: "webp",
    signature: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP",
  },
} satisfies Record<string, { extension: string; signature: (bytes: Uint8Array) => boolean }>;

async function ensureCategoryImageBucket(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(`Unable to check category image storage: ${listError.message}`);

  const existingBucket = buckets.find((bucket) => bucket.id === bucketName);
  if (existingBucket) {
    if (!existingBucket.public) throw new Error("The product-images storage bucket must be public for category images.");
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(bucketName, {
    public: true,
    fileSizeLimit: "6MB",
    allowedMimeTypes: Object.keys(imageTypes),
  });
  if (createError) {
    const { data: refreshedBuckets, error: refreshError } = await supabase.storage.listBuckets();
    if (refreshError || !refreshedBuckets.some((bucket) => bucket.id === bucketName && bucket.public)) {
      throw new Error(`Unable to create category image storage: ${createError.message}`);
    }
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ categoryId: string }> },
) {
  try {
    const [{ getPermissionGuard }, { createSupabaseServiceClient: createServiceClient }] = await Promise.all([
      import("@/lib/auth/server"),
      import("@/lib/supabase/server"),
    ]);
    const guard = await getPermissionGuard("products.update");
    if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });

    const { categoryId } = await params;
    if (!categoryIdSchema.safeParse(categoryId).success) {
      return NextResponse.json({ error: "A valid category is required." }, { status: 400 });
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > maxFileSize + 64 * 1024) {
      return NextResponse.json({ error: "Choose an image smaller than 6 MB." }, { status: 413 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose a category image to upload." }, { status: 400 });
    }
    if (file.size > maxFileSize) {
      return NextResponse.json({ error: "Choose an image smaller than 6 MB." }, { status: 413 });
    }

    const imageType = Object.entries(imageTypes).find(([mimeType]) => mimeType === file.type)?.[1];
    if (!imageType) return NextResponse.json({ error: "Use a JPG, PNG, or WEBP image." }, { status: 415 });

    const imageBytes = new Uint8Array(await file.arrayBuffer());
    if (!imageType.signature(imageBytes)) {
      return NextResponse.json({ error: "The image content does not match its file type." }, { status: 415 });
    }

    const supabase = createServiceClient();
    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .maybeSingle();
    if (categoryError) throw new Error(`Unable to check category: ${categoryError.message}`);
    if (!category) return NextResponse.json({ error: "Category not found." }, { status: 404 });

    await ensureCategoryImageBucket(supabase);
    const storagePath = `categories/${categoryId}/${crypto.randomUUID()}.${imageType.extension}`;
    const { error: uploadError } = await supabase.storage.from(bucketName).upload(storagePath, imageBytes, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) throw new Error(`Unable to upload category image: ${uploadError.message}`);

    const imageUrl = supabase.storage.from(bucketName).getPublicUrl(storagePath).data.publicUrl;
    const { error: updateError } = await supabase
      .from("categories")
      .update({ image_url: imageUrl })
      .eq("id", categoryId);
    if (updateError) {
      const { error: cleanupError } = await supabase.storage.from(bucketName).remove([storagePath]);
      if (cleanupError) console.error("Unable to clean up an unlinked category image:", cleanupError.message);
      throw new Error(`Unable to save the category image: ${updateError.message}`);
    }

    return NextResponse.json({ data: { categoryId, imageUrl } });
  } catch (error) {
    console.error("Category image upload failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to upload category image." },
      { status: 500 },
    );
  }
}
