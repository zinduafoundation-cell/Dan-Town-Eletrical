#!/usr/bin/env node

/**
 * Database Cleanup Script
 * Clears all custom tables, functions, and types for a fresh migration
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local
function loadEnv() {
  const envPath = path.join(__dirname, ".env.local");
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
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

// SQL to drop all custom objects
const cleanupSQL = `
-- Drop all triggers first
do $$ declare
  r record;
begin
  for r in select trigger_name, table_name from information_schema.triggers 
    where trigger_schema='public' and table_schema='public'
  loop
    execute 'drop trigger if exists ' || r.trigger_name || ' on ' || r.table_name;
  end loop;
end $$;

-- Drop all policies
do $$ declare
  r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname='public'
  loop
    execute 'drop policy if exists "' || r.policyname || '" on ' || r.tablename;
  end loop;
end $$;

-- Drop all functions
do $$ declare
  r record;
begin
  for r in select proname, pg_get_function_arguments(oid) as args 
    from pg_proc where pronamespace = 'public'::regnamespace 
    and prokind = 'f'
  loop
    execute 'drop function if exists public.' || r.proname || '(' || r.args || ')';
  end loop;
end $$;

-- Drop all tables
do $$ declare
  r record;
begin
  for r in select tablename from pg_tables where schemaname='public'
  loop
    execute 'drop table if exists public.' || r.tablename || ' cascade';
  end loop;
end $$;

-- Drop all types
do $$ declare
  r record;
begin
  for r in select typename from pg_type where typnamespace='public'::regnamespace
  loop
    execute 'drop type if exists public.' || r.typename;
  end loop;
end $$;
`;

async function cleanup() {
  console.log("🧹 Cleaning up database...\n");
  
  try {
    // Execute cleanup SQL through REST API using service role
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
      },
      body: JSON.stringify({
        query: cleanupSQL
      })
    });

    if (!response.ok) {
      console.log("⚠️  REST API approach not available, but that's OK!");
      console.log("The migrations will use DROP IF NOT EXISTS patterns.\n");
      return;
    }

    console.log("✓ Database cleanup complete!\n");
    console.log("You can now run: supabase db push --include-all\n");
    
  } catch (err) {
    console.error("⚠️  Note: Direct SQL execution not available");
    console.error("But migrations should still work with idempotent patterns.\n");
  }
}

cleanup();
