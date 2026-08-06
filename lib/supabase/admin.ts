import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS. Server-only (API routes), never imported client-side.
// Used for fan-facing operations (checkout, webhook, my-drops lookup, streaming) since fans
// never hold a Supabase Auth session under the phone-based access model.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
