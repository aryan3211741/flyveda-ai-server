import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 8787),
  corsOrigins: (process.env.CORS_ORIGINS ?? "*")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  supabase: {
    // Project REST URL, e.g. https://<ref>.supabase.co
    url: process.env.SUPABASE_URL ?? "",
    // Server-only key with full DB access (bypasses RLS). NEVER ship to the app.
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    // Public key (used only to construct a JWT-verifying client). Safe to expose.
    anonKey: process.env.SUPABASE_ANON_KEY ?? "",
  },

  // Per-user request limits over a rolling window (used by rate-limit middleware).
  rateLimit: {
    windowSeconds: Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 60),
    maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 30),
  },

  llm: {
    // Which provider is active (primary). Add new ones in src/llm/client.ts registry.
    provider: (process.env.LLM_PROVIDER ?? "anthropic").toLowerCase(),
    // Optional fallback provider used only when the primary throws.
    // Empty string disables fallback (single-provider behavior).
    fallbackProvider: (process.env.LLM_FALLBACK_PROVIDER ?? "").toLowerCase(),

    // Provider-neutral generation settings. Default: Claude Sonnet 4.6.
    model: process.env.LLM_MODEL ?? "claude-sonnet-4-6",
    generationModel:
      process.env.LLM_MODEL_GENERATION ?? process.env.LLM_MODEL ?? "claude-sonnet-4-6",
    temperature: Number(process.env.LLM_TEMPERATURE ?? 0.3),
    maxTokens: Number(process.env.LLM_MAX_TOKENS ?? 1200),

    // Provider-specific credentials. Each provider reads only its own block,
    // and validates its key lazily when first used.
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    },
    sarvam: {
      apiKey: process.env.SARVAM_API_KEY ?? "",
      model: process.env.SARVAM_MODEL ?? "sarvam-30b",
      baseUrl: process.env.SARVAM_BASE_URL ?? "https://api.sarvam.ai/v1",
    },
    // llama:  { baseUrl: process.env.LLAMA_BASE_URL ?? "", apiKey: process.env.LLAMA_API_KEY ?? "" },
  },
} as const;

export type SupabaseMode = "service_role" | "anon" | "disabled";

/**
 * How the server will talk to Supabase:
 *  - "service_role": trusted backend, bypasses RLS (preferred for production).
 *  - "anon": forwards the user's JWT so RLS enforces access (works with only the
 *    anon/publishable key — e.g. a project created by another tool like Lovable).
 *  - "disabled": no DB; AI endpoints still work, persistence is off.
 */
export function supabaseMode(): SupabaseMode {
  if (!config.supabase.url) return "disabled";
  if (config.supabase.serviceRoleKey) return "service_role";
  if (config.supabase.anonKey) return "anon";
  return "disabled";
}

/** True when the server can reach Supabase in either mode. */
export function isSupabaseConfigured(): boolean {
  return supabaseMode() !== "disabled";
}
