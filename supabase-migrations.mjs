#!/usr/bin/env node

/**
 * Supabase Migration Runner
 * Applies all SQL migrations in order using direct Postgres connection
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "pg";

const { Client } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_DB_URL = process.env.DATABASE_URL || 
  "postgresql://postgres:YOUR_PASSWORD@vldccdtuwwyumqdkyxde.supabase.co:5432/postgres?sslmode=require";

async function runMigrations() {
  const client = new Client({
    connectionString: SUPABASE_DB_URL,
  });

  try {
    await client.connect();
    console.log("✓ Connected to Supabase PostgreSQL");

    const migrationsDir = path.join(__dirname, "supabase", "migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    console.log(`\nFound ${files.length} migration files\n`);

    let appliedCount = 0;
    let skippedCount = 0;

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8").trim();

      if (!sql) {
        console.log(`⊘ Skipped ${file} (empty file)`);
        skippedCount++;
        continue;
      }

      try {
        console.log(`Applying: ${file}`);
        
        // Execute the migration
        await client.query(sql);
        
        console.log(`✓ Applied: ${file}\n`);
        appliedCount++;
      } catch (err) {
        console.error(`✗ Error in ${file}:`);
        console.error(`  ${err.message}\n`);
        
        // Continue with next migration instead of stopping
        // This allows partial application in case of issues
      }
    }

    console.log(`\n===== Migration Summary =====`);
    console.log(`✓ Applied: ${appliedCount}`);
    console.log(`⊘ Skipped: ${skippedCount}`);
    console.log(`Total: ${files.length}`);
    console.log(`==============================\n`);

  } catch (err) {
    console.error("Failed to connect to database:");
    console.error(err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
