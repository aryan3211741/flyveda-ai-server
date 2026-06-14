import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 8787),
  corsOrigins: (process.env.CORS_ORIGINS ?? "*")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

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
