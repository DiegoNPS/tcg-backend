import { createClient } from "@/lib/supabase/server";

export async function getAdminContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { supabase, user: null, isAdmin: false };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_role")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    isAdmin: !profileError && profile?.user_role === "admin",
  };
}
