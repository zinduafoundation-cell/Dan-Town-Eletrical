import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

export type CartItemInput = {
  product_id: string;
  quantity: number;
  unit_price?: number;
};

export type CartItem = {
  id: string;
  cart_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  created_at: string;
  updated_at: string;
};

async function getOrCreateCart(
  client: SupabaseClient<Database>,
  userId: string
) {
  const { data: cart, error: cartLookupError } = await client
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (cartLookupError && cartLookupError.code !== "PGRST116") {
    return { cart: null, error: cartLookupError };
  }

  if (cart) {
    return { cart, error: null };
  }

  const { data: newCart, error: createCartError } = await client
    .from("carts")
    .insert({ user_id: userId })
    .select("id")
    .single();

  return { cart: newCart, error: createCartError };
}

/**
 * Add or update an item in the user's cart
 */
export async function addToCart(
  client: SupabaseClient<Database>,
  userId: string,
  item: CartItemInput
) {
  const { cart, error: cartError } = await getOrCreateCart(client, userId);

  if (cartError || !cart) {
    return { error: cartError ?? new Error("Unable to create cart") };
  }

  const { data: existing, error: checkError } = await client
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cart.id)
    .eq("product_id", item.product_id)
    .maybeSingle();

  if (checkError && checkError.code !== "PGRST116") {
    console.error("Error checking for existing cart item:", checkError);
    return { error: checkError };
  }

  if (existing) {
    const { error } = await client
      .from("cart_items")
      .update({
        quantity: existing.quantity + item.quantity
      })
      .eq("id", existing.id);

    return { error };
  }

  const { error } = await client.from("cart_items").insert({
    cart_id: cart.id,
    product_id: item.product_id,
    variant_id: null,
    quantity: item.quantity
  });

  return { error };
}

/**
 * Get all items in the user's cart
 */
export async function getCartItems(
  client: SupabaseClient<Database>,
  userId: string
) {
  const { cart, error: cartError } = await getOrCreateCart(client, userId);

  if (cartError || !cart) {
    return { items: [], error: cartError ?? new Error("Unable to load cart") };
  }

  const { data, error } = await client
    .from("cart_items")
    .select("*")
    .eq("cart_id", cart.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching cart items:", error);
    return { items: [], error };
  }

  return { items: data || [], error: null };
}

/**
 * Remove an item from the cart
 */
export async function removeFromCart(
  client: SupabaseClient<Database>,
  userId: string,
  productId: string
) {
  const { cart, error: cartError } = await getOrCreateCart(client, userId);

  if (cartError || !cart) {
    return { error: cartError ?? new Error("Unable to load cart") };
  }

  const { error } = await client
    .from("cart_items")
    .delete()
    .eq("cart_id", cart.id)
    .eq("product_id", productId);

  return { error };
}

/**
 * Update quantity of an item in the cart
 */
export async function updateCartItemQuantity(
  client: SupabaseClient<Database>,
  userId: string,
  productId: string,
  quantity: number
) {
  const { cart, error: cartError } = await getOrCreateCart(client, userId);

  if (cartError || !cart) {
    return { error: cartError ?? new Error("Unable to load cart") };
  }

  if (quantity <= 0) {
    return removeFromCart(client, userId, productId);
  }

  const { error } = await client
    .from("cart_items")
    .update({
      quantity
    })
    .eq("cart_id", cart.id)
    .eq("product_id", productId);

  return { error };
}

/**
 * Clear all items from the user's cart
 */
export async function clearCart(
  client: SupabaseClient<Database>,
  userId: string
) {
  const { cart, error: cartError } = await getOrCreateCart(client, userId);

  if (cartError || !cart) {
    return { error: cartError ?? new Error("Unable to load cart") };
  }

  const { error } = await client
    .from("cart_items")
    .delete()
    .eq("cart_id", cart.id);

  return { error };
}

/**
 * Get cart summary (total items and subtotal)
 */
export async function getCartSummary(
  client: SupabaseClient<Database>,
  userId: string
) {
  const { cart, error: cartError } = await getOrCreateCart(client, userId);

  if (cartError || !cart) {
    return {
      itemCount: 0,
      subtotal: 0,
      error: cartError ?? new Error("Unable to load cart")
    };
  }

  const { data, error } = await client
    .from("cart_items")
    .select("quantity")
    .eq("cart_id", cart.id);

  if (error) {
    console.error("Error fetching cart summary:", error);
    return {
      itemCount: 0,
      subtotal: 0,
      error
    };
  }

  const itemCount = data.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = 0;

  return {
    itemCount,
    subtotal,
    error: null
  };
}
