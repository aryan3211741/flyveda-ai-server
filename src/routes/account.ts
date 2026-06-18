import { Router } from "express";
import { asyncHandler, HttpError } from "../middleware/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { getMessages, getSession, listSessions } from "../repositories/chats.js";
import { getProgress } from "../repositories/progress.js";
import { listAttempts } from "../repositories/quizzes.js";
import { getUsageSummary } from "../repositories/usage.js";

export const accountRouter = Router();

/** GET /api/ai/chats — the signed-in user's chat sessions (most recent first). */
accountRouter.get(
  "/chats",
  requireAuth,
  asyncHandler(async (req, res) => {
    const sessions = await listSessions(req.db!, req.user!.id);
    res.json({ sessions });
  })
);

/** GET /api/ai/chats/:id — one session with its full message history. */
accountRouter.get(
  "/chats/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const session = await getSession(req.db!, req.user!.id, req.params.id);
    if (!session) throw new HttpError(404, "Chat session not found.");
    const messages = await getMessages(req.db!, session.id);
    res.json({ session, messages });
  })
);

/** GET /api/ai/progress — per-topic mastery plus recent attempts. */
accountRouter.get(
  "/progress",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [progress, recentAttempts] = await Promise.all([
      getProgress(req.db!, req.user!.id),
      listAttempts(req.db!, req.user!.id, 50),
    ]);
    res.json({ progress, recentAttempts });
  })
);

/** GET /api/ai/usage — the user's own usage summary. */
accountRouter.get(
  "/usage",
  requireAuth,
  asyncHandler(async (req, res) => {
    const summary = await getUsageSummary(req.db!, req.user!.id);
    res.json(summary);
  })
);
