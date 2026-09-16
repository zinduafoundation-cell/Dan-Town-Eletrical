import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthorizationContext } from "@/lib/auth/server";
import {
  addToCart,
  removeFromCart,
  updateCartItemQuantity,
  getCartItems,
  getCartSummary,
  clearCart
} from "@dantown/database";

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthorizationContext();
    if (!context?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const body = await request.json();
    const { action, product_id, quantity, unit_price } = body;

    switch (action) {
      case "add": {
        if (!product_id || !quantity || !unit_price) {
          return NextResponse.json(
            { error: "Missing required fields: product_id, quantity, unit_price" },
            { status: 400 }
          );
        }

        const result = await addToCart(supabase, context.userId, {
          product_id,
          quantity: Number(quantity),
          unit_price: Number(unit_price)
        });

        if (result.error) {
          return NextResponse.json({ error: result.error.message }, { status: 500 });
        }

        const items = await getCartItems(supabase, context.userId);
        return NextResponse.json({ items: items.items });
      }

      case "remove": {
        if (!product_id) {
          return NextResponse.json(
            { error: "Missing required field: product_id" },
            { status: 400 }
          );
        }

        const result = await removeFromCart(supabase, context.userId, product_id);

        if (result.error) {
          return NextResponse.json({ error: result.error.message }, { status: 500 });
        }

        const items = await getCartItems(supabase, context.userId);
        return NextResponse.json({ items: items.items });
      }

      case "update": {
        if (!product_id || quantity === undefined) {
          return NextResponse.json(
            { error: "Missing required fields: product_id, quantity" },
            { status: 400 }
          );
        }

        const result = await updateCartItemQuantity(
          supabase,
          context.userId,
          product_id,
          Number(quantity)
        );

        if (result.error) {
          return NextResponse.json({ error: result.error.message }, { status: 500 });
        }

        const items = await getCartItems(supabase, context.userId);
        return NextResponse.json({ items: items.items });
      }

      case "clear": {
        const result = await clearCart(supabase, context.userId);

        if (result.error) {
          return NextResponse.json({ error: result.error.message }, { status: 500 });
        }

        return NextResponse.json({ items: [] });
      }

      case "get": {
        const items = await getCartItems(supabase, context.userId);

        if (items.error) {
          return NextResponse.json({ error: items.error.message }, { status: 500 });
        }

        return NextResponse.json({ items: items.items });
      }

      case "summary": {
        const summary = await getCartSummary(supabase, context.userId);

        if (summary.error) {
          return NextResponse.json({ error: summary.error.message }, { status: 500 });
        }

        return NextResponse.json({
          itemCount: summary.itemCount,
          subtotal: summary.subtotal
        });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Cart API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
