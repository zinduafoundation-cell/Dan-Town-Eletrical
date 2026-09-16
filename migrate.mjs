import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const url = "https://vldccdtuwwyumqdkyxde.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsZGNjZHR1d3d5dW1xZGt5eGRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTA1NDcsImV4cCI6MjEwMzU4NjU0N30.brvmqpWD3zPQfVY_sK0h_qqCyzgLgvhibGlkZmn6lRc";

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "public" }
});

async function applyMigrations() {
  const migrationsDir = "./supabase/migrations";
  const files = fs.readdirSync(migrationsDir).sort();
  
  for (const file of files) {
    if (!file.endsWith(".sql")) continue;
    
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf-8");
    
    console.log(`Applying migration: ${file}`);
    
    try {
      const { error } = await supabase.rpc("exec_sql", { sql_text: sql });
      if (error) {
        // Try direct approach if rpc doesn't exist
        const response = await fetch(`${url}/rest/v1/`, {
          method: "POST",
          headers: {
            "apikey": serviceRoleKey,
            "Authorization": `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ query: sql })
        });
        
        if (!response.ok) {
          console.warn(`Warning for ${file}:`, response.statusText);
        } else {
          console.log(`✓ ${file} applied`);
        }
      } else {
        console.log(`✓ ${file} applied`);
      }
    } catch (err) {
      console.error(`Error applying ${file}:`, err.message);
    }
  }
}

applyMigrations().then(() => console.log("Migrations complete")).catch(err => console.error("Migration failed:", err));
