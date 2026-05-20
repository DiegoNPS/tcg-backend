import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { requireSupabaseEnv } from "./config";

let browserClient: SupabaseClient<Database> | null = null;

export function createClient() {
  if (!browserClient) {
    const { url, publishableKey } = requireSupabaseEnv();
    browserClient = createBrowserClient<Database>(url, publishableKey);
  }

  return browserClient;
}
