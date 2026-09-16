#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "supabase", "migrations");

const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql"));

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  let content = fs.readFileSync(filePath, "utf-8");
  
  // Fix do $ begin/end patterns
  content = content.replace(/do\s+\$\s+begin/g, "do $$ begin");
  content = content.replace(/end\s+\$;/g, "end $$;");
  
  fs.writeFileSync(filePath, content, "utf-8");
  console.log(`Fixed: ${file}`);
}

console.log("\n✓ All migration files fixed!");
