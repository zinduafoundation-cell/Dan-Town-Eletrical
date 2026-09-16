import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
    const separator = line.indexOf("=");
    return [line.slice(0, separator), line.slice(separator + 1).replace(/^['"]|['"]$/g, "")];
  }));
}

const root = process.cwd();
const env = { ...loadEnv(path.join(root, "apps", "web", ".env.local")), ...process.env };
const email = process.env.TARGET_USER_EMAIL;
if (!email) throw new Error("TARGET_USER_EMAIL is required");
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase server credentials are missing");

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: users, error: userError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (userError) throw userError;
const user = users.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
if (!user) throw new Error(`No Supabase Auth user found for ${email}`);

const { data: role, error: roleError } = await supabase.from("roles").select("id, code").eq("code", "ADMIN").single();
if (roleError) throw roleError;
const { error: assignmentError } = await supabase.from("user_roles").upsert({ user_id: user.id, role_id: role.id }, { onConflict: "user_id,role_id" });
if (assignmentError) throw assignmentError;
console.log(`Centre access granted to ${email} using the existing ADMIN role.`);
