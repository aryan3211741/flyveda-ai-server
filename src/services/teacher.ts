import type { ChatMessage } from "../llm/client.js";
import { chat, chatStream } from "../llm/client.js";
import {
  syllabusContextBlock,
  teacherSystemPrompt,
} from "../llm/prompts.js";
import { retrieveTopics, type Goal, type RetrievedTopic } from "../syllabus/syllabus.js";
import type { TeacherRequest } from "../schemas.js";

export interface TeacherContext {
  citations: RetrievedTopic[];
  messages: ChatMessage[];
}

/**
 * Builds the full prompt: persona + retrieved syllabus context + conversation.
 * Retrieval is keyed off the latest user message.
 */
function buildContext(req: TeacherRequest): TeacherContext {
  const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
  const citations = lastUser
    ? retrieveTopics(lastUser.content, req.goal as Goal | undefined)
    : [];

  const system: ChatMessage = {
    role: "system",
    content: teacherSystemPrompt(req.goal as Goal | undefined),
  };

  const messages: ChatMessage[] = [system];
  const context = syllabusContextBlock(citations);
  if (context) {
    messages.push({ role: "system", content: context });
  }
  for (const m of req.messages) {
    messages.push({ role: m.role, content: m.content });
  }

  return { citations, messages };
}

export async function answerOnce(
  req: TeacherRequest
): Promise<{ answer: string; citations: RetrievedTopic[] }> {
  const { citations, messages } = buildContext(req);
  const answer = await chat(messages);
  return { answer, citations };
}

export function answerStream(req: TeacherRequest): {
  citations: RetrievedTopic[];
  stream: AsyncGenerator<string>;
} {
  const { citations, messages } = buildContext(req);
  return { citations, stream: chatStream(messages) };
}
