import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getUserWishlist() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, wishlist: null };

  const { data: wishlist, error } = await supabase
    .from("wishlists")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;

  return { supabase, user, wishlist };
}

export async function POST(request: NextRequest) {
  const productId = String((await request.json()).productId ?? "").trim();
  if (!productId) return NextResponse.json({ error: "Product is required." }, { status: 400 });

  const { supabase, user, wishlist: existingWishlist } = await getUserWishlist();
  if (!user) return NextResponse.json({ error: "Sign in to save products." }, { status: 401 });

  let wishlistId = existingWishlist?.id;
  if (!wishlistId) {
    const { data, error } = await supabase
      .from("wishlists")
      .insert({ user_id: user.id, created_at: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    wishlistId = data.id;
  }

  const { error } = await supabase
    .from("wishlist_items")
    .upsert({ wishlist_id: wishlistId, product_id: productId, created_at: new Date().toISOString() }, { onConflict: "wishlist_id,product_id" });
  if (error) throw error;

  return NextResponse.json({ saved: true });
}

export async function DELETE(request: NextRequest) {
  const productId = String((await request.json()).productId ?? "").trim();
  if (!productId) return NextResponse.json({ error: "Product is required." }, { status: 400 });

  const { supabase, user, wishlist } = await getUserWishlist();
  if (!user) return NextResponse.json({ error: "Sign in to manage saved products." }, { status: 401 });
  if (!wishlist) return NextResponse.json({ saved: false });

  const { error } = await supabase
    .from("wishlist_items")
    .delete()
    .eq("wishlist_id", wishlist.id)
    .eq("product_id", productId);
  if (error) throw error;

  return NextResponse.json({ saved: false });
}
