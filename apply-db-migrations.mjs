#!/usr/bin/env node

/**
 * Apply all database migrations to Supabase using the REST API
 * This reads all .sql files from supabase/migrations and executes them in order
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://vldccdtuwwyumqdkyxde.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsZGNjZHR1d3d5dW1xZGt5eGRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTA1NDcsImV4cCI6MjEwMzU4NjU0N30.brvmqpWD3zPQfVY_sK0h_qqCyzgLgvhibGlkZmn6lRc';

async function executeSql(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ sql }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`HTTP ${response.status}:`, text);
    return { error: text };
  }

  return { success: true };
}

async function applyMigrations() {
  const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files`);

  const requiredMigrations = [
    '001_extensions.sql',
    '002_profiles.sql',
    '003_roles_permissions.sql',
    '004_categories_brands.sql',
    '005_products.sql',
    '008_customers.sql',
    '009_cart_wishlist.sql',
  ];

  for (const file of requiredMigrations) {
    if (!files.includes(file)) {
      console.log(`❌ Missing migration: ${file}`);
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`\nApplying: ${file}`);
    console.log(`SQL Length: ${sql.length} characters`);

    const result = await executeSql(sql);
    
    if (result.error) {
      console.error(`❌ Failed to apply ${file}`);
      console.error(result.error);
    } else {
      console.log(`✓ Applied: ${file}`);
    }

    // Add a small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n✓ Migration process complete');
}

applyMigrations().catch(console.error);
