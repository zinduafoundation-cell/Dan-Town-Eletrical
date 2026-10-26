import { NextResponse } from "next/server";
import { z } from "zod";
import { getPermissionGuard } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bucketName = "product-images";
const maxFileSize = 6 * 1024 * 1024;
const uploadSchema = z.object({
  slot: z.enum(["desktop", "mobile"]),
  campaignId: z.string().uuid().optional(),
});
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

async function ensureBannerBucket(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(`Unable to check banner storage: ${error.message}`);
  if (buckets.some((bucket) => bucket.id === bucketName && bucket.public)) return;
  if (buckets.some((bucket) => bucket.id === bucketName)) {
    throw new Error("The product-images storage bucket must be public for storefront banners.");
  }

  const { error: createError } = await supabase.storage.createBucket(bucketName, {
    public: true,
    fileSizeLimit: "6MB",
    allowedMimeTypes: Object.keys(imageTypes),
  });
  if (createError) {
    const { data: refreshedBuckets, error: refreshError } = await supabase.storage.listBuckets();
    if (refreshError || !refreshedBuckets.some((bucket) => bucket.id === bucketName && bucket.public)) {
      throw new Error(`Unable to create banner storage: ${createError.message}`);
    }
  }
}

export async function POST(request: Request) {
  try {
    const guard = await getPermissionGuard("products.update");
    if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > maxFileSize + 64 * 1024) {
      return NextResponse.json({ error: "Choose an image smaller than 6 MB." }, { status: 413 });
    }
    const form = await request.formData();
    const parsed = uploadSchema.safeParse({
      slot: form.get("slot"),
      campaignId: form.get("campaignId") || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Choose whether this is a desktop or mobile banner." }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose a banner image to upload." }, { status: 400 });
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

    const supabase = createSupabaseServiceClient();
    await ensureBannerBucket(supabase);
    const campaign = parsed.data.campaignId ?? "draft";
    const storagePath = `promotions/${campaign}/${crypto.randomUUID()}-${parsed.data.slot}.${imageType.extension}`;
    const { error: uploadError } = await supabase.storage.from(bucketName).upload(storagePath, imageBytes, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) throw new Error(`Unable to upload banner image: ${uploadError.message}`);

    const imageUrl = supabase.storage.from(bucketName).getPublicUrl(storagePath).data.publicUrl;
    return NextResponse.json({ data: { imageUrl } });
  } catch (error) {
    console.error("Homepage banner upload failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to upload banner image." },
      { status: 500 },
    );
  }
}
