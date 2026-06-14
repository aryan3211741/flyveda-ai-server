import { config } from "../../config.js";
import type { ChatMessage, ChatOptions, LLMProvider } from "../types.js";

/**
 * Sarvam provider.
 *
 * Sarvam exposes an OpenAI-compatible Chat Completions API, so this talks to it
 * directly over fetch (no extra SDK dependency). Unlike Anthropic, the system
 * prompt is just a message with role "system", so the uniform message list maps
 * across 1:1.
 *
 * Model + key come from SARVAM_MODEL / SARVAM_API_KEY. The endpoint defaults to
 * Sarvam's API and can be overridden with SARVAM_BASE_URL.
 */

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      // Sarvam-M is a reasoning model: `content` can be null while the answer
      // text is returned in `reasoning_content`.
      content?: string | null;
      reasoning_content?: string | null;
    };
  }>;
}

interface ChatCompletionChunk {
  choices?: Array<{
    delta?: {
      // Same reasoning-model shape on the stream: text may arrive in
      // `reasoning_content` while `content` is null.
      content?: string | null;
      reasoning_content?: string | null;
    };
  }>;
}

export function createSarvamProvider(): LLMProvider {
  const { apiKey, model, baseUrl } = config.llm.sarvam;
  if (!apiKey) {
    throw new Error("Missing SARVAM_API_KEY (required when LLM_PROVIDER=sarvam)");
  }
  if (!model) {
    throw new Error("Missing SARVAM_MODEL (required when LLM_PROVIDER=sarvam)");
  }

  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  function headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      // Sarvam's native auth header.
      "api-subscription-key": apiKey,
      // Also sent for the OpenAI-compatible path; harmless if the API ignores it.
      Authorization: `Bearer ${apiKey}`,
    };
  }

  function body(messages: ChatMessage[], opts: ChatOptions, stream: boolean) {
    return JSON.stringify({
      model: opts.model ?? model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: opts.temperature ?? config.llm.temperature,
      max_tokens: opts.maxTokens ?? config.llm.maxTokens,
      stream,
      // JSON requests: force valid JSON into message.content and disable
      // reasoning so the token budget is not spent on reasoning_content.
      ...(opts.json
        ? {
            response_format: { type: "json_object" },
            reasoning_effort: null,
          }
        : {}),
    });
  }

  async function failure(res: Response): Promise<Error> {
    const text = await res.text().catch(() => "");
    return new Error(`Sarvam API error ${res.status}: ${text}`);
  }

  return {
    name: "sarvam",

    async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: headers(),
        body: body(messages, opts, false),
      });
      if (!res.ok) throw await failure(res);

      const data = (await res.json()) as ChatCompletionResponse;
      const message = data.choices?.[0]?.message;
      // Prefer content; fall back to reasoning_content when content is null
      // (Sarvam-M reasoning model); empty string only if both are missing.
      return message?.content ?? message?.reasoning_content ?? "";
    },

    async *chatStream(
      messages: ChatMessage[],
      opts: ChatOptions = {}
    ): AsyncGenerator<string> {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: headers(),
        body: body(messages, opts, true),
      });
      if (!res.ok || !res.body) throw await failure(res);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") return;
          try {
            const chunk = JSON.parse(payload) as ChatCompletionChunk;
            const choiceDelta = chunk.choices?.[0]?.delta;
            // Prefer content; fall back to reasoning_content (Sarvam-M).
            const delta = choiceDelta?.content ?? choiceDelta?.reasoning_content;
            if (delta) yield delta;
          } catch {
            // Ignore keep-alive lines / partial fragments.
          }
        }
      }
    },
  };
}
