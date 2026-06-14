/**
 * Provider-neutral LLM contract.
 *
 * Every provider (Anthropic today; Sarvam, Llama, OpenAI later) implements this
 * single interface. The rest of the app only ever talks to this contract via
 * `src/llm/client.ts`, so adding a provider never touches services or routes.
 */

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatOptions {
  /** Override the default model for this call (e.g. a stronger generation model). */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Hint that the caller expects a JSON object back (providers may use it). */
  json?: boolean;
}

export interface LLMProvider {
  /** Stable identifier, e.g. "anthropic" | "sarvam" | "llama". */
  readonly name: string;
  /** Single-shot completion → full text. */
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>;
  /** Streaming completion → yields text deltas. */
  chatStream(messages: ChatMessage[], opts?: ChatOptions): AsyncGenerator<string>;
}

/** A zero-arg constructor for a provider, used by the registry in client.ts. */
export type ProviderFactory = () => LLMProvider;
