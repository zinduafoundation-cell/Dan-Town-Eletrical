import { NextResponse } from "next/server";

const BUCKET = "product-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  try {
    const [{ requireAuthorizedPermission }, { createSupabaseServiceClient }] = await Promise.all([
      import("../../../../../lib/auth/server"),
      import("../../../../../lib/supabase/server")
    ]);
    await requireAuthorizedPermission("products.update");
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Please choose an image file." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Use a JPG, PNG, WEBP, or GIF image." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Images must be 5 MB or smaller." }, { status: 400 });
    }

    const extension = file.type.split("/")[1].replace("jpeg", "jpg");
    const path = `products/${crypto.randomUUID()}.${extension}`;
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false
    });

    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (error) {
    console.error("PRODUCT IMAGE UPLOAD ERROR", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to upload image." },
      { status: 500 }
    );
  }
}
