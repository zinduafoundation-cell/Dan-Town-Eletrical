import { isBskEmailAddress } from "@/lib/auth/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

export async function hasBusinessCenterAccess(userId: string, email?: string | null) {
  if (userId === "dev-bypass-user") return false;
  if (email === undefined) {
    const sessionClient = await createSupabaseServerClient();
    const { data: { user }, error } = await sessionClient.auth.getUser();
    if (error) {
      console.error("Business Centre identity lookup failed", error);
      throw new Error("Unable to verify Business Centre identity.");
    }
    if (!user || user.id !== userId) return false;
    email = user.email;
  }

  if (isBskEmailAddress(email)) return true;

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("business_center_access")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Business Centre access lookup failed", error);
    throw new Error("Unable to verify Business Centre access.");
  }

  return Boolean(data);
}
