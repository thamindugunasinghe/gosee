import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client for server actions only (creating auth users, invoking
// edge functions). Never import from client components.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
