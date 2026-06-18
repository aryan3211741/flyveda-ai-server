import { Router } from "express";
import { teacherRequestSchema } from "../schemas.js";
import { answerOnce, answerStream } from "../services/teacher.js";
import { asyncHandler, HttpError } from "../middleware/errors.js";
import { optionalAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import {
  appendMessage,
  createSession,
  getSession,
  touchSession,
} from "../repositories/chats.js";
import { logUsage } from "../repositories/usage.js";
import { activeModel, activeProviderName } from "../llm/client.js";
import type { Request } from "express";

export const teacherRouter = Router();

function lastUserContent(messages: { role: string; content: string }[]): string {
  return [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
}

function titleFrom(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 60 ? `${t.slice(0, 57)}...` : t || "New chat";
}

/**
 * Resolves the chat session to write to (creating one when needed) and persists
 * the newest user turn. Returns the session id, or null when persistence is off
 * (anonymous request or Supabase not configured).
 */
async function beginPersistedTurn(
  req: Request,
  parsed: { messages: { role: string; content: string }[]; goal?: string; sessionId?: string }
): Promise<string | null> {
  const user = req.user;
  const db = req.db;
  if (!user || !db) return null;

  const userContent = lastUserContent(parsed.messages);
  let sessionId = parsed.sessionId ?? null;

  if (sessionId) {
    const session = await getSession(db, user.id, sessionId);
    if (!session) throw new HttpError(404, "Chat session not found.");
  } else {
    const session = await createSession(db, user.id, {
      title: titleFrom(userContent),
      goal: parsed.goal ?? null,
    });
    sessionId = session.id;
  }

  if (userContent) {
    await appendMessage(db, { sessionId, userId: user.id, role: "user", content: userContent });
  }
  return sessionId;
}

/**
 * POST /api/ai/teacher
 * Body: { messages: [{role, content}], goal?, sessionId?, stream? }
 *
 * When stream is true (default) responds with Server-Sent Events:
 *   event: meta   -> { citations: [...], sessionId }   (sent first)
 *   event: delta  -> { text: "..." }                    (many)
 *   event: done   -> { sessionId }                       (last)
 * Otherwise responds with a single JSON: { answer, citations, sessionId }.
 *
 * Auth is optional: anonymous calls work but are not persisted; signed-in calls
 * persist the conversation and are rate limited.
 */
teacherRouter.post(
  "/teacher",
  optionalAuth,
  rateLimit,
  asyncHandler(async (req, res) => {
    const parsed = teacherRequestSchema.parse(req.body);
    const startedAt = Date.now();
    const sessionId = await beginPersistedTurn(req, parsed);

    if (!parsed.stream) {
      const result = await answerOnce(parsed);
      if (sessionId && req.user && req.db) {
        await appendMessage(req.db, {
          sessionId,
          userId: req.user.id,
          role: "assistant",
          content: result.answer,
          citations: result.citations,
        });
        await touchSession(req.db, sessionId);
      }
      await logUsage(req.db, {
        userId: req.user?.id ?? null,
        endpoint: "teacher",
        provider: activeProviderName(),
        model: activeModel(),
        latencyMs: Date.now() - startedAt,
        status: "ok",
      });
      res.json({ ...result, sessionId });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const { citations, stream } = answerStream(parsed);
    res.write(`event: meta\ndata: ${JSON.stringify({ citations, sessionId })}\n\n`);

    let answer = "";
    let status = "ok";
    try {
      for await (const delta of stream) {
        answer += delta;
        res.write(`event: delta\ndata: ${JSON.stringify({ text: delta })}\n\n`);
      }
      res.write(`event: done\ndata: ${JSON.stringify({ sessionId })}\n\n`);
    } catch (err) {
      status = "error";
      const message = err instanceof Error ? err.message : "stream_error";
      res.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
    } finally {
      res.end();
    }

    if (sessionId && req.user && req.db && answer) {
      try {
        await appendMessage(req.db, {
          sessionId,
          userId: req.user.id,
          role: "assistant",
          content: answer,
          citations,
        });
        await touchSession(req.db, sessionId);
      } catch (err) {
        console.warn("[teacher] failed to persist assistant message:", String(err));
      }
    }
    await logUsage(req.db, {
      userId: req.user?.id ?? null,
      endpoint: "teacher",
      provider: activeProviderName(),
      model: activeModel(),
      latencyMs: Date.now() - startedAt,
      status,
    });
  })
);
