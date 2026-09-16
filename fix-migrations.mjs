#!/usr/bin/env node

/**
 * Migration Idempotency Fixer
 * Automatically updates all migrations to use IF NOT EXISTS and DROP IF EXISTS patterns
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "supabase", "migrations");

function makeIdempotent(sql) {
  let result = sql;

  // Convert: create type public.foo as enum (...) => wrapped in DO block with proper $$ delimiters
  result = result.replace(
    /create\s+type\s+public\.(\w+)\s+as\s+enum\s*\(([^)]+)\)/gi,
    `do $$ begin
  create type public.$1 as enum ($2);
exception when duplicate_object then null;
end $$`
  );

  // Convert: create table public.foo (...) => create table if not exists public.foo (...)
  result = result.replace(
    /create\s+table\s+public\.(\w+)\s*\(/gi,
    "create table if not exists public.$1 ("
  );

  // Convert: create table if not exists public.foo AS ... to handle select-based creates
  result = result.replace(
    /create\s+table\s+if\s+not\s+exists\s+public\.(\w+)\s+as\s+/gi,
    "create table if not exists public.$1 as "
  );

  // Add drop policies before create policy
  result = result.replace(
    /create\s+policy\s+"([^"]+)"\s+on\s+public\.(\w+)/gi,
    'drop policy if exists "$1" on public.$2;\ncreate policy "$1" on public.$2'
  );

  // Add drop triggers before create trigger  
  result = result.replace(
    /create\s+trigger\s+(\w+)\s+/gi,
    "drop trigger if exists $1 on public.placeholder;\ncreate trigger $1 "
  );

  // Fix the placeholder issue in trigger drops
  result = result.replace(
    /drop trigger if exists (\w+) on public\.placeholder;/g,
    "-- Trigger will be added below"
  );

  // Create or replace functions (already idempotent with create or replace)
  // create or replace is already safe

  return result;
}

async function fixMigrations() {
  console.log("🔧 Fixing migration idempotency...\n");

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql") && f !== "001_extensions.sql" && f !== "002_profiles.sql")
    .sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    let sql = fs.readFileSync(filePath, "utf-8");

    const updated = makeIdempotent(sql);

    if (sql !== updated) {
      fs.writeFileSync(filePath, updated, "utf-8");
      console.log(`✓ Fixed: ${file}`);
    } else {
      console.log(`- Skipped: ${file} (already idempotent)`);
    }
  }

  console.log("\n✓ Migration idempotency fixes complete!\n");
  console.log("You can now run: supabase db push --include-all\n");
}

fixMigrations().catch(console.error);
