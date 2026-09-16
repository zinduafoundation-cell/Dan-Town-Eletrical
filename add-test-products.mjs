import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://vldccdtuwwyumqdkyxde.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsZGNjZHR1d3d5dW1xZGt5eGRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODAxMDU0NywiZXhwIjoyMTAzNTg2NTQ3fQ.bYTMrsWTcDtq6QtDnLIRLG3EOpoMm-yqc-sQg6QlkBA";

const supabase = createClient(supabaseUrl, supabaseKey);

async function addTestProducts() {
  try {
    console.log("Fetching or creating category...");

    // Get or create category
    const { data: categories } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", "electrical-supply")
      .single();

    let categoryId = categories?.id;

    if (!categoryId) {
      console.log("Creating new category...");
      const { data: newCat, error: createError } = await supabase
        .from("categories")
        .insert([
          {
            name: "Electrical Supply",
            slug: "electrical-supply",
            description: "Electrical supplies and equipment",
            is_active: true
          }
        ])
        .select("id")
        .single();

      if (createError) throw createError;
      categoryId = newCat.id;
    }

    console.log("Category ID:", categoryId);

    // Add test products
    const products = [
      {
        sku: "CABLE-001",
        name: "Electrical Cable 2.5mm",
        slug: "electrical-cable-2-5mm",
        description: "High quality electrical cable for installations",
        cost_price: 150,
        retail_price: 250,
        vat_rate: 16,
        status: "ACTIVE",
        is_active: true,
        category_id: categoryId
      },
      {
        sku: "SOCKET-001",
        name: "Power Socket Outlet",
        slug: "power-socket-outlet",
        description: "Durable power socket outlet for residential use",
        cost_price: 80,
        retail_price: 150,
        vat_rate: 16,
        status: "ACTIVE",
        is_active: true,
        category_id: categoryId
      },
      {
        sku: "BULB-001",
        name: "LED Bulb 10W",
        slug: "led-bulb-10w",
        description: "Energy efficient LED bulb - 10W bright white",
        cost_price: 120,
        retail_price: 200,
        vat_rate: 16,
        status: "ACTIVE",
        is_active: true,
        category_id: categoryId
      },
      {
        sku: "SWITCH-001",
        name: "Light Switch - Single Gang",
        slug: "light-switch-single-gang",
        description: "Professional grade single gang light switch",
        cost_price: 50,
        retail_price: 100,
        vat_rate: 16,
        status: "ACTIVE",
        is_active: true,
        category_id: categoryId
      }
    ];

    console.log("Adding test products...");
    const { data: insertedProducts, error: insertError } = await supabase
      .from("products")
      .upsert(products, { onConflict: "sku" })
      .select("id, sku");

    if (insertError) {
      console.error("Insert error:", insertError);
      throw insertError;
    }

    console.log("Products added:", insertedProducts);

    // Get warehouse and add inventory
    console.log("Fetching warehouse...");
    let { data: warehouses, error: whError } = await supabase
      .from("warehouses")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .single();

    let warehouseId;

    if (whError) {
      console.log("No active warehouse found. Creating one...");
      const { data: newWarehouse, error: createWHError } = await supabase
        .from("warehouses")
        .insert([
          {
            name: "Main Warehouse",
            code: "MAIN-001",
            location: "Nairobi",
            is_active: true
          }
        ])
        .select("id")
        .single();

      if (createWHError) {
        console.error("Warehouse creation error:", createWHError);
        return;
      }

      warehouseId = newWarehouse.id;
    } else {
      warehouseId = warehouses.id;
    }

    console.log("Warehouse ID:", warehouseId);

    // Add inventory for each product
    const inventory = insertedProducts.map((product, index) => ({
      product_id: product.id,
      warehouse_id: warehouseId,
      quantity: [50, 120, 200, 80][index]
    }));

    console.log("Adding inventory...");
    const { error: invError } = await supabase
      .from("inventory")
      .insert(inventory);

    if (invError) {
      console.error("Inventory error:", invError);
      throw invError;
    }

    console.log("✅ Test products and inventory added successfully!");
  } catch (error) {
    console.error("Error:", error);
  }
}

addTestProducts();
