#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "supabase", "migrations");

const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith(".sql"))
  .sort();

console.log("🔧 Final comprehensive migration fixer...\n");

let totalFixed = 0;

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  let content = fs.readFileSync(filePath, "utf-8");
  const original = content;
  
  // First normalize all line endings
  content = content.replace(/\r\n/g, "\n");
  
  // Fix all instances of: do $ begin with variations  
  content = content.replace(/do\s+\$\s+begin/g, "do $$ begin");
  content = content.replace(/do\s+\$\s*begin/g, "do $$ begin");
  
  // Fix all instances of: end $ with variations 
  content = content.replace(/end\s+\$\s*;/g, "end $$;");
  content = content.replace(/end\s+\$\s*\n/g, "end $$;\n");
  
  // Double check - look for any remaining  single-$ patterns in do blocks
  content = content.replace(/(\bdo\s+\$\$\s+begin[\s\S]*?)end\s+\$\s*(;|\n)/g, "$1end $$;$2");
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, "utf-8");
    console.log(`✓ Fixed: ${file}`);
    totalFixed++;
  } else {
    console.log(`- OK: ${file}`);
  }
}

console.log(`\n✓ Migration fixer complete! Fixed ${totalFixed} files`);
