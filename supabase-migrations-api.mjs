#!/usr/bin/env node

/**
 * Supabase Migration Runner (REST API version)
 * Applies all SQL migrations using Supabase's direct SQL execution
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local
function loadEnv() {
  const envPath = path.join(__dirname, ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("❌ Error: .env.local file not found");
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, "utf-8");
  const env = {};
  
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    
    const [key, ...valueParts] = trimmed.split("=");
    env[key.trim()] = valueParts.join("=").trim();
  });

  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

async function executeSql(sql) {
  try {
    // Supabase's SQL execution endpoint
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "apikey": SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ sql }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { error: `HTTP ${response.status}: ${text}` };
    }

    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
}

async function runMigrations() {
  const migrationsDir = path.join(__dirname, "supabase", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`🔄 Connecting to Supabase...\n`);
  console.log(`Found ${files.length} migration files\n`);

  let appliedCount = 0;
  let errorCount = 0;

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    let sql = fs.readFileSync(filePath, "utf-8").trim();

    if (!sql) {
      console.log(`⊘ Skipped ${file} (empty file)`);
      continue;
    }

    try {
      console.log(`Applying: ${file}`);
      
      const result = await executeSql(sql);
      
      if (result.error) {
        console.error(`✗ Error in ${file}:`);
        console.error(`  ${result.error}\n`);
        errorCount++;
      } else {
        console.log(`✓ Applied: ${file}\n`);
        appliedCount++;
      }
    } catch (err) {
      console.error(`✗ Error applying ${file}:`, err.message, "\n");
      errorCount++;
    }

    // Add a small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n===== Migration Summary =====`);
  console.log(`✓ Applied: ${appliedCount}`);
  console.log(`✗ Errors: ${errorCount}`);
  console.log(`Total: ${files.length}`);
  console.log(`==============================\n`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
