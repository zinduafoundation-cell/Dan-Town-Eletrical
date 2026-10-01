import { NextResponse } from "next/server";
import type { Database } from "@dantown/database";
import { z } from "zod";
import { getPermissionGuard } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bucketName = "product-images";
const maxFileSize = 6 * 1024 * 1024;
type ProductImageInsert = Database["public"]["Tables"]["product_images"]["Insert"];
const imageTypes = {
  "image/jpeg": { extension: "jpg", signature: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: "png", signature: (bytes: Uint8Array) => bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10" },
  "image/webp": { extension: "webp", signature: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" },
} satisfies Record<string, { extension: string; signature: (bytes: Uint8Array) => boolean }>;

const productIdSchema = z.string().uuid();

async function ensureProductImageBucket(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(`Unable to check product image storage: ${listError.message}`);

  const existingBucket = buckets.find((bucket) => bucket.id === bucketName);
  if (existingBucket) {
    if (!existingBucket.public) throw new Error("The product-images storage bucket must be public for storefront images.");
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
      throw new Error(`Unable to create product image storage: ${createError.message}`);
    }
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const guard = await getPermissionGuard("products.update");
    if (!guard.ok) {
      return NextResponse.json({ error: guard.message }, { status: guard.status });
    }

    const { productId } = await params;
    if (!productIdSchema.safeParse(productId).success) {
      return NextResponse.json({ error: "A valid product is required." }, { status: 400 });
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > maxFileSize + 64 * 1024) {
      return NextResponse.json({ error: "Choose an image smaller than 6 MB." }, { status: 413 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose a product image to upload." }, { status: 400 });
    }
    if (file.size > maxFileSize) {
      return NextResponse.json({ error: "Choose an image smaller than 6 MB." }, { status: 413 });
    }

    const imageType = Object.entries(imageTypes).find(([mimeType]) => mimeType === file.type)?.[1];
    if (!imageType) {
      return NextResponse.json({ error: "Use a JPG, PNG, or WEBP image." }, { status: 415 });
    }

    const imageBytes = new Uint8Array(await file.arrayBuffer());
    if (!imageType.signature(imageBytes)) {
      return NextResponse.json({ error: "The image content does not match its file type." }, { status: 415 });
    }

    const supabase = createSupabaseServiceClient();
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id,name")
      .eq("id", productId)
      .maybeSingle();
    if (productError) throw new Error(`Unable to check product: ${productError.message}`);
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

    await ensureProductImageBucket(supabase);
    const storagePath = `products/${productId}/${crypto.randomUUID()}.${imageType.extension}`;
    const { error: uploadError } = await supabase.storage.from(bucketName).upload(storagePath, imageBytes, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) throw new Error(`Unable to upload product image: ${uploadError.message}`);

    const imageUrl = supabase.storage.from(bucketName).getPublicUrl(storagePath).data.publicUrl;
    const { data: existingImage, error: imageLookupError } = await supabase
      .from("product_images")
      .select("id")
      .eq("product_id", productId)
      .eq("is_primary", true)
      .maybeSingle();

    if (imageLookupError) {
      await supabase.storage.from(bucketName).remove([storagePath]);
      throw new Error(`Unable to update the product image: ${imageLookupError.message}`);
    }

    let saveError: { message: string } | null = null;
    if (existingImage) {
      const { error } = await supabase
        .from("product_images")
        .update({ image_url: imageUrl, alt_text: `Product photo of ${product.name}` })
        .eq("id", existingImage.id);
      saveError = error;
    } else {
      const image: ProductImageInsert = {
        product_id: productId,
        image_url: imageUrl,
        alt_text: `Product photo of ${product.name}`,
        sort_order: 0,
        is_primary: true,
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("product_images").insert(image);
      saveError = error;
    }

    if (saveError) {
      const { error: cleanupError } = await supabase.storage.from(bucketName).remove([storagePath]);
      if (cleanupError) console.error("Unable to clean up an unlinked product image:", cleanupError.message);
      throw new Error(`Unable to save the product image: ${saveError.message}`);
    }

    return NextResponse.json({ data: { productId, imageUrl } });
  } catch (error) {
    console.error("Product image upload failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to upload product image." },
      { status: 500 },
    );
  }
}
