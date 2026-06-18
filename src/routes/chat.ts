import { Router } from "express";
import { chatRequestSchema } from "../schemas.js";
import { answerOnce } from "../services/teacher.js";
import { asyncHandler } from "../middleware/errors.js";
import { optionalAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { logUsage } from "../repositories/usage.js";
import { activeModel, activeProviderName } from "../llm/client.js";

export const chatRouter = Router();

/**
 * POST /api/ai/chat
 * A simple, app-friendly wrapper over the AI Teacher.
 *
 * Body: { message: string, history?: [{ role, content }], goal? }
 * Returns: { answer: string, citations: [...] }
 *
 * This forwards to the same logic as POST /api/ai/teacher (non-streaming), but
 * with a single-message contract that's trivial to call from a chat UI.
 */
chatRouter.post(
  "/chat",
  optionalAuth,
  rateLimit,
  asyncHandler(async (req, res) => {
    const { message, history, goal } = chatRequestSchema.parse(req.body);
    const startedAt = Date.now();

    // Build the conversation: prior turns (if any) + the new user message.
    const messages = [...history, { role: "user" as const, content: message }];

    try {
      const { answer, citations } = await answerOnce({
        messages,
        goal,
        stream: false,
      });

      await logUsage(req.db, {
        userId: req.user?.id ?? null,
        endpoint: "chat",
        provider: activeProviderName(),
        model: activeModel(),
        latencyMs: Date.now() - startedAt,
        status: "ok",
      });

      res.json({ answer, citations });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error("[chat] AI request failed:", detail);

      await logUsage(req.db, {
        userId: req.user?.id ?? null,
        endpoint: "chat",
        provider: activeProviderName(),
        model: activeModel(),
        latencyMs: Date.now() - startedAt,
        status: "error",
      });

      // Friendly, non-leaky error for the app to show the user.
      res.status(502).json({
        error: "ai_unavailable",
        message:
          "The AI couldn't generate an answer right now. Please try again in a moment.",
      });
    }
  })
);
