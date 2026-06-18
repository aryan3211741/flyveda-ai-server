import type { SupabaseClient } from "../db/supabase.js";

export interface UsageEvent {
  userId: string | null;
  endpoint: string;
  provider?: string | null;
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  latencyMs?: number | null;
  status?: string | null;
}

/**
 * Fire-and-forget usage log; never throws into the request path. Pass the
 * request-scoped client; when it is absent (anonymous request) logging is
 * skipped because there is no user to attribute the event to.
 */
export async function logUsage(
  db: SupabaseClient | undefined,
  event: UsageEvent
): Promise<void> {
  if (!db) return;
  try {
    const { error } = await db.from("usage_events").insert({
      user_id: event.userId,
      endpoint: event.endpoint,
      provider: event.provider ?? null,
      model: event.model ?? null,
      tokens_in: event.tokensIn ?? null,
      tokens_out: event.tokensOut ?? null,
      latency_ms: event.latencyMs ?? null,
      status: event.status ?? null,
    });
    if (error) console.warn("[usage] failed to log event:", error.message);
  } catch (err) {
    console.warn("[usage] failed to log event:", String(err));
  }
}

/** Number of requests by a user since the given ISO timestamp (rate limiting). */
export async function countSince(
  db: SupabaseClient,
  userId: string,
  sinceIso: string
): Promise<number> {
  const { count, error } = await db
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", sinceIso);
  if (error) throw error;
  return count ?? 0;
}

export interface UsageSummary {
  total: number;
  byEndpoint: Record<string, number>;
}

/** Lightweight per-user usage summary for the /usage endpoint. */
export async function getUsageSummary(
  db: SupabaseClient,
  userId: string,
  limit = 1000
): Promise<UsageSummary> {
  const { data, error } = await db
    .from("usage_events")
    .select("endpoint")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data as { endpoint: string }[]) ?? [];
  const byEndpoint: Record<string, number> = {};
  for (const r of rows) byEndpoint[r.endpoint] = (byEndpoint[r.endpoint] ?? 0) + 1;
  return { total: rows.length, byEndpoint };
}
