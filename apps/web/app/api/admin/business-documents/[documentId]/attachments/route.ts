import { NextResponse } from "next/server";
import { getPermissionGuard } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bucket = "business-documents-private";
const maxBytes = 10 * 1024 * 1024;
const mimeToExtension = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

function contentMatches(mime: keyof typeof mimeToExtension, bytes: Uint8Array) {
  if (mime === "application/pdf") return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const guard = await getPermissionGuard("settings.manage");
    if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
    const { documentId } = await context.params;
    const supabase = createSupabaseServiceClient();
    const { data: attachments, error } = await supabase.from("business_document_attachments")
      .select("id,business_document_id,file_name,mime_type,size_bytes,created_at,storage_path")
      .eq("business_document_id", documentId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const result = await Promise.all((attachments ?? []).map(async (attachment) => {
      const { data, error: signedUrlError } = await supabase.storage.from(bucket).createSignedUrl(attachment.storage_path, 300);
      if (signedUrlError) throw signedUrlError;
      return {
        id: attachment.id,
        business_document_id: attachment.business_document_id,
        file_name: attachment.file_name,
        mime_type: attachment.mime_type,
        size_bytes: attachment.size_bytes,
        created_at: attachment.created_at,
        download_url: data.signedUrl,
      };
    }));
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Unable to load private business document attachments:", error);
    return NextResponse.json({ error: "Attachments could not be loaded." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const guard = await getPermissionGuard("settings.manage");
    if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
    const { documentId } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a PDF, JPG, PNG, or WEBP file." }, { status: 400 });
    if (file.size < 1 || file.size > maxBytes) return NextResponse.json({ error: "Files must be no larger than 10 MB." }, { status: 400 });
    if (!(file.type in mimeToExtension)) return NextResponse.json({ error: "Only PDF, JPG, PNG, and WEBP files are allowed." }, { status: 400 });

    const parsedBytes = new Uint8Array(await file.arrayBuffer());
    if (!contentMatches(file.type as keyof typeof mimeToExtension, parsedBytes)) {
      return NextResponse.json({ error: "The file content does not match its declared type." }, { status: 400 });
    }
    const supabase = createSupabaseServiceClient();
    const { data: document, error: documentError } = await supabase.from("business_documents")
      .select("id")
      .eq("id", documentId)
      .maybeSingle();
    if (documentError) throw documentError;
    if (!document) return NextResponse.json({ error: "Business document not found." }, { status: 404 });

    const safeName = file.name.replace(/[^\w .()-]/g, "_").trim().slice(0, 240) || `attachment.${mimeToExtension[file.type as keyof typeof mimeToExtension]}`;
    const storagePath = `${document.id}/${crypto.randomUUID()}.${mimeToExtension[file.type as keyof typeof mimeToExtension]}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, parsedBytes, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data: attachment, error: insertError } = await supabase.from("business_document_attachments")
      .insert({
        business_document_id: document.id,
        storage_path: storagePath,
        file_name: safeName,
        mime_type: file.type as keyof typeof mimeToExtension,
        size_bytes: file.size,
        uploaded_by: guard.context?.userId === "dev-bypass-user" ? null : guard.context?.userId ?? null,
      })
      .select("id,business_document_id,file_name,mime_type,size_bytes,created_at")
      .single();
    if (insertError) {
      const { error: cleanupError } = await supabase.storage.from(bucket).remove([storagePath]);
      if (cleanupError) console.error("Unable to clean up orphaned business document attachment:", cleanupError.message);
      throw insertError;
    }
    return NextResponse.json({ data: attachment }, { status: 201 });
  } catch (error) {
    console.error("Unable to upload business document attachment:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Attachment could not be saved." }, { status: 500 });
  }
}
