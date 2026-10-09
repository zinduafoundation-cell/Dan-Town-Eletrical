import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const DELIVERY_PROOF_BUCKET = "delivery-proofs";
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuthenticated();
    const { id: orderId } = await params;
    const formData = await request.formData();
    const proof = formData.get("proof");
    if (!(proof instanceof File)) {
      return NextResponse.json({ error: "Choose a photo or signature image as proof." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(proof.type)) {
      return NextResponse.json({ error: "Proof must be a JPG, PNG, or WebP image." }, { status: 400 });
    }
    if (proof.size <= 0 || proof.size > MAX_PROOF_BYTES) {
      return NextResponse.json({ error: "Proof image must be smaller than 5 MB." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer) return NextResponse.json({ error: "Customer account not found." }, { status: 404 });

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,order_number,customer_id,order_status,delivery_proof_path")
      .eq("id", orderId)
      .eq("customer_id", customer.id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.order_status !== "DELIVERED") {
      return NextResponse.json({ error: "You can submit delivery proof after the order is marked delivered." }, { status: 409 });
    }

    const extension = proof.type === "image/jpeg" ? "jpg" : proof.type === "image/png" ? "png" : "webp";
    const storagePath = `${orderId}/${context.userId}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(DELIVERY_PROOF_BUCKET)
      .upload(storagePath, Buffer.from(await proof.arrayBuffer()), {
        contentType: proof.type,
        upsert: false
      });
    if (uploadError) throw uploadError;

    const confirmedAt = new Date().toISOString();
    const { data: confirmedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        delivery_proof_path: storagePath,
        delivery_confirmed_at: confirmedAt,
        delivery_confirmed_by: context.userId
      })
      .eq("id", orderId)
      .eq("customer_id", customer.id)
      .eq("order_status", "DELIVERED")
      .select("id")
      .maybeSingle();
    if (updateError || !confirmedOrder) {
      const { error: cleanupError } = await supabase.storage
        .from(DELIVERY_PROOF_BUCKET)
        .remove([storagePath]);
      if (cleanupError) console.error("Failed to clean up unlinked delivery proof:", cleanupError);
      if (updateError) throw updateError;
      return NextResponse.json({ error: "This order is no longer eligible for delivery confirmation." }, { status: 409 });
    }

    if (order.delivery_proof_path) {
      const { error: oldProofCleanupError } = await supabase.storage
        .from(DELIVERY_PROOF_BUCKET)
        .remove([order.delivery_proof_path]);
      if (oldProofCleanupError) console.error("Failed to remove replaced delivery proof:", oldProofCleanupError);
    }

    return NextResponse.json({
      success: true,
      confirmedAt,
      message: `Delivery for ${order.order_number} confirmed. Thank you.`
    });
  } catch (error) {
    console.error("DELIVERY PROOF SUBMISSION ERROR", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save delivery proof." },
      { status: 500 }
    );
  }
}
