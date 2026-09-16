import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^['"]|['"]$/g, "")];
      })
  );
}

const root = process.cwd();
const env = {
  ...loadEnv(path.join(root, ".env.local")),
  ...loadEnv(path.join(root, "apps", "web", ".env.local")),
  ...process.env
};
const databaseUrl = env.DATABASE_URL;
if (!databaseUrl || databaseUrl.includes("YOUR_PASSWORD")) {
  throw new Error("DATABASE_URL is missing. Put it in the root .env.local file and run this command again.");
}

const migrationPath = path.join(root, "supabase", "migrations", "024_pos_staff_attribution.sql");
const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(fs.readFileSync(migrationPath, "utf8"));
  await client.query("NOTIFY pgrst, 'reload schema'");
  await client.query("COMMIT");

  const result = await client.query(`
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'complete_pos_sale'
  `);
  if (!result.rowCount) throw new Error("Migration completed but complete_pos_sale was not found.");
  console.log("POS RPC installed and PostgREST schema reload requested.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  if (error instanceof Error) {
    console.error("POS RPC repair failed:", error.message || error.name);
    if ("code" in error) console.error("Database error code:", error.code);
    if ("detail" in error && error.detail) console.error("Database detail:", error.detail);
  } else {
    console.error("POS RPC repair failed:", error);
  }
  process.exitCode = 1;
} finally {
  await client.end();
}
