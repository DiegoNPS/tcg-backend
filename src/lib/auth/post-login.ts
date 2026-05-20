import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

export async function resolvePostLoginPath(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const [{ data: profile }, { data: tienda }] = await Promise.all([
    supabase.from("profiles").select("user_role").eq("user_id", userId).maybeSingle(),
    supabase.from("tiendas").select("id").eq("owner_id", userId).maybeSingle(),
  ]);

  if (profile?.user_role === "admin") return "/admin";
  if (tienda) return "/tienda/dashboard";
  if (profile?.user_role === "jugador") return "/jugador/inscripciones";
  return "/torneos";
}