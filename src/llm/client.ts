import { config } from "../config.js";
import type { ChatMessage, ChatOptions, LLMProvider, ProviderFactory } from "./types.js";
import { createAnthropicProvider } from "./providers/anthropic.js";
import { createSarvamProvider } from "./providers/sarvam.js";

export type { ChatMessage, ChatOptions } from "./types.js";

/**
 * Provider registry. To add a new backend (Sarvam, Llama, OpenAI, …):
 *   1. create src/llm/providers/<name>.ts exporting a factory returning LLMProvider
 *   2. register it here
 *   3. set LLM_PROVIDER=<name> in .env
 * Nothing else in the codebase changes.
 */
const PROVIDERS: Record<string, ProviderFactory> = {
  anthropic: createAnthropicProvider,
  sarvam: createSarvamProvider,
  // llama: createLlamaProvider,     // TODO: src/llm/providers/llama.ts
  // openai: createOpenAIProvider,   // TODO: src/llm/providers/openai.ts
};

/** Lazily-instantiated providers, cached by name so primary + fallback coexist. */
const cache = new Map<string, LLMProvider>();

function getProvider(name: string): LLMProvider {
  const existing = cache.get(name);
  if (existing) return existing;
  const factory = PROVIDERS[name];
  if (!factory) {
    throw new Error(
      `Unknown provider "${name}". Available: ${Object.keys(PROVIDERS).join(", ")}`
    );
  }
  const provider = factory();
  cache.set(name, provider);
  return provider;
}

/** The primary provider (LLM_PROVIDER). */
function primaryProvider(): LLMProvider {
  return getProvider(config.llm.provider);
}

/**
 * The fallback provider (LLM_FALLBACK_PROVIDER), or null when fallback is
 * disabled or points at the primary. Instantiation is lazy; a missing key only
 * surfaces if the fallback is actually exercised.
 */
function fallbackProvider(): LLMProvider | null {
  const name = config.llm.fallbackProvider;
  if (!name || name === config.llm.provider) return null;
  return getProvider(name);
}

/**
 * Resolve the fallback without throwing. If the fallback can't be built (e.g.
 * missing key) we log and return null so the caller rethrows the ORIGINAL error
 * instead of masking it with a fallback construction failure.
 */
function safeFallback(primaryError: unknown): LLMProvider | null {
  try {
    return fallbackProvider();
  } catch (fbErr) {
    console.warn(
      `[llm] fallback provider "${config.llm.fallbackProvider}" unavailable (${String(
        fbErr
      )}); surfacing primary error`
    );
    return null;
  }
}

/** Drop provider-specific overrides so the fallback uses its own default model. */
function withoutModelOverride(opts: ChatOptions): ChatOptions {
  const { model: _model, ...rest } = opts;
  return rest;
}

/** Active (primary) provider name (used for /health and startup logs). */
export function activeProviderName(): string {
  return config.llm.provider;
}

/** Fallback provider name, or null when disabled (for /health and logs). */
export function activeFallbackName(): string | null {
  const name = config.llm.fallbackProvider;
  return name && name !== config.llm.provider ? name : null;
}

/** Model a given provider will use by default (for /health and startup logs). */
function modelFor(providerName: string): string {
  switch (providerName) {
    case "sarvam":
      return config.llm.sarvam.model;
    case "anthropic":
    default:
      return config.llm.model;
  }
}

/** Model the active (primary) provider will use (for /health and startup logs). */
export function activeModel(): string {
  return modelFor(config.llm.provider);
}

/** Non-streaming completion → full text. Falls back to Claude if the primary throws. */
export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  const primary = primaryProvider();
  try {
    return await primary.chat(messages, opts);
  } catch (err) {
    const fb = safeFallback(err);
    if (!fb) throw err;
    console.warn(
      `[llm] primary "${primary.name}" failed: ${String(err)} — falling back to "${fb.name}"`
    );
    return await fb.chat(messages, withoutModelOverride(opts));
  }
}

/**
 * Streaming completion → yields text deltas. Falls back to the fallback provider
 * ONLY if the primary fails before emitting any token; once streaming has begun
 * the error propagates (no mid-stream replay / duplication).
 */
export async function* chatStream(
  messages: ChatMessage[],
  opts: ChatOptions = {}
): AsyncGenerator<string> {
  const primary = primaryProvider();
  let started = false;
  try {
    for await (const delta of primary.chatStream(messages, opts)) {
      started = true;
      yield delta;
    }
    return;
  } catch (err) {
    if (started) throw err;
    const fb = safeFallback(err);
    if (!fb) throw err;
    console.warn(
      `[llm] primary "${primary.name}" failed before first token: ${String(err)} — falling back to "${fb.name}"`
    );
    yield* fb.chatStream(messages, withoutModelOverride(opts));
  }
}

/**
 * Calls a single provider expecting JSON and parses it, retrying once with a
 * repair nudge if the first response is not valid JSON.
 */
async function chatJsonOnce<T>(
  provider: LLMProvider,
  messages: ChatMessage[],
  opts: ChatOptions
): Promise<T> {
  const first = await provider.chat(messages, { ...opts, json: true });
  try {
    return JSON.parse(stripFences(first)) as T;
  } catch {
    const repaired = await provider.chat(
      [
        ...messages,
        { role: "assistant", content: first },
        {
          role: "user",
          content:
            "That was not valid JSON. Respond again with ONLY the valid JSON object, no prose, no markdown fences.",
        },
      ],
      { ...opts, json: true }
    );
    return JSON.parse(stripFences(repaired)) as T;
  }
}

/**
 * Calls the model expecting JSON and parses it. Provider-agnostic. Falls back to
 * the fallback provider if the primary throws OR returns unparseable JSON (even
 * after its repair retry).
 */
export async function chatJson<T = unknown>(
  messages: ChatMessage[],
  opts: ChatOptions = {}
): Promise<T> {
  const primary = primaryProvider();
  try {
    return await chatJsonOnce<T>(primary, messages, opts);
  } catch (err) {
    const fb = safeFallback(err);
    if (!fb) throw err;
    console.warn(
      `[llm] primary "${primary.name}" JSON call failed: ${String(err)} — falling back to "${fb.name}"`
    );
    return await chatJsonOnce<T>(fb, messages, withoutModelOverride(opts));
  }
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
}
