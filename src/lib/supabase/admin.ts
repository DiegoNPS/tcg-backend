import { createClient as createPublicClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { getSupabaseEnv } from "./config";

export function createAdminClient() {
  const env = getSupabaseEnv();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE || null;

  if (!env || !serviceRole) return null;

  return createPublicClient<Database>(env.url, serviceRole, {
    auth: {
      persistSession: false,
    },
  });
}

export default createAdminClient;
