import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config, supabaseMode } from "../config.js";

/**
 * Server-side Supabase access, supporting two modes (see config.supabaseMode):
 *
 *  - service_role: a single admin client that bypasses RLS. Used for all data
 *    access; the server still scopes every query by user_id itself.
 *  - anon: a per-request client built with the anon key AND the user's JWT, so
 *    Postgres RLS enforces that the user only touches their own rows. This is
 *    what lets the server run with only SUPABASE_URL + SUPABASE_ANON_KEY.
 */

export type { SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

/** Service-role client (throws if the service_role key is not configured). */
export function getAdminClient(): SupabaseClient {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    throw new Error(
      "Service-role access requested but SUPABASE_SERVICE_ROLE_KEY is not set."
    );
  }
  if (!adminClient) {
    adminClient = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}

/** Base anon client, used only to call the Auth API (token verification). */
function getAnonClient(): SupabaseClient {
  if (!config.supabase.url || !config.supabase.anonKey) {
    throw new Error("Anon access requested but SUPABASE_ANON_KEY is not set.");
  }
  if (!anonClient) {
    anonClient = createClient(config.supabase.url, config.supabase.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return anonClient;
}

/**
 * The data-access client to use for a request made by a user holding `token`.
 * In service_role mode this is the admin client; in anon mode it is a client
 * that forwards the user's JWT so RLS applies.
 */
export function dbForUser(token: string): SupabaseClient {
  if (supabaseMode() === "service_role") return getAdminClient();
  return createClient(config.supabase.url, config.supabase.anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface AuthUser {
  id: string;
  email: string | null;
}

/**
 * Verifies a Supabase access token and returns the user, or null if missing or
 * invalid. Uses whichever client is available to reach the Auth API.
 */
export async function verifyAccessToken(token: string): Promise<AuthUser | null> {
  if (!token) return null;
  const client =
    supabaseMode() === "service_role" ? getAdminClient() : getAnonClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
