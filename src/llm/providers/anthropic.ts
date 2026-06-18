import Anthropic from "@anthropic-ai/sdk";
import { config } from "../../config.js";
import type { ChatMessage, ChatOptions, LLMProvider } from "../types.js";

/**
 * Anthropic Claude provider (official @anthropic-ai/sdk).
 *
 * Note the Messages API shape difference vs. OpenAI: the system prompt is a
 * top-level field, not a message with role "system". We extract any "system"
 * messages here so the rest of the app can keep using a uniform message list.
 */
export function createAnthropicProvider(): LLMProvider {
  const apiKey = config.llm.anthropic.apiKey;
  if (!apiKey) {
    throw new Error(
      "Missing ANTHROPIC_API_KEY (required when LLM_PROVIDER=anthropic)"
    );
  }

  const client = new Anthropic({
    apiKey,
    // Render cold starts + long Teacher prompts can exceed default timeouts.
    timeout: 120_000,
    maxRetries: 3,
  });

  function split(messages: ChatMessage[]): {
    system?: string;
    messages: Anthropic.MessageParam[];
  } {
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");

    const convo: Anthropic.MessageParam[] = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    return { system: system || undefined, messages: convo };
  }

  return {
    name: "anthropic",

    async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
      const { system, messages: convo } = split(messages);
      const res = await client.messages.create({
        model: opts.model ?? config.llm.model,
        max_tokens: opts.maxTokens ?? config.llm.maxTokens,
        temperature: opts.temperature ?? config.llm.temperature,
        ...(system ? { system } : {}),
        messages: convo,
      });

      return res.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");
    },

    async *chatStream(
      messages: ChatMessage[],
      opts: ChatOptions = {}
    ): AsyncGenerator<string> {
      const { system, messages: convo } = split(messages);
      const stream = await client.messages.create({
        model: opts.model ?? config.llm.model,
        max_tokens: opts.maxTokens ?? config.llm.maxTokens,
        temperature: opts.temperature ?? config.llm.temperature,
        ...(system ? { system } : {}),
        messages: convo,
        stream: true,
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield event.delta.text;
        }
      }
    },
  };
}
