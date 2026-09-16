#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "supabase", "migrations");

const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith(".sql"))
  .sort();

console.log("🔧 Comprehensive migration fixer...\n");

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  let content = fs.readFileSync(filePath, "utf-8");
  const original = content;
  
  // Fix: do $ begin => do $$ begin
  content = content.replace(/do\s+\$\s+begin/g, "do $$ begin");
  
  // Fix: end $ => end $$  (with various spacing)
  content = content.replace(/end\s+\$\s*;/g, "end $$;");
  
  // Fix any remaining patterns
  content = content.replace(/\$\s*;/g, "$$;");
  
  // Fix double semicolons from bad replacements
  content = content.replace(/;;/g, ";");
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, "utf-8");
    console.log(`✓ Fixed: ${file}`);
  } else {
    console.log(`- OK: ${file}`);
  }
}

console.log("\n✓ All migration files fixed!");
