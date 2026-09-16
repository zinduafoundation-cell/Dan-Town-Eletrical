#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "supabase", "migrations");

const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith(".sql"))
  .sort();

console.log("🔧 Direct string replacement fixer...\n");

let totalFixed = 0;

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  let content = fs.readFileSync(filePath, "utf-8");
  const original = content;
  
  // Direct string replacements - order matters!
  content = content.split("do $ begin").join("do $$ begin");
  content = content.split("end $;").join("end $$;");
  content = content.split("end $ \n").join("end $$;\n");
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, "utf-8");
    console.log(`✓ Fixed: ${file}`);
    totalFixed++;
  } else {
    console.log(`- OK: ${file}`);
  }
}

console.log(`\n✓ All files processed! Fixed ${totalFixed} files`);
