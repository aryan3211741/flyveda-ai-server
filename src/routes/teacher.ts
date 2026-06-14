import { Router } from "express";
import { teacherRequestSchema } from "../schemas.js";
import { answerOnce, answerStream } from "../services/teacher.js";
import { asyncHandler } from "../middleware/errors.js";

export const teacherRouter = Router();

/**
 * POST /api/ai/teacher
 * Body: { messages: [{role, content}], goal?, stream? }
 *
 * When stream is true (default) responds with Server-Sent Events:
 *   event: meta   -> { citations: [...] }      (sent first)
 *   event: delta  -> { text: "..." }           (many)
 *   event: done   -> {}                          (last)
 * Otherwise responds with a single JSON: { answer, citations }.
 */
teacherRouter.post(
  "/teacher",
  asyncHandler(async (req, res) => {
    const parsed = teacherRequestSchema.parse(req.body);

    if (!parsed.stream) {
      const result = await answerOnce(parsed);
      res.json(result);
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const { citations, stream } = answerStream(parsed);
    res.write(`event: meta\ndata: ${JSON.stringify({ citations })}\n\n`);

    try {
      for await (const delta of stream) {
        res.write(`event: delta\ndata: ${JSON.stringify({ text: delta })}\n\n`);
      }
      res.write(`event: done\ndata: {}\n\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "stream_error";
      res.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
    } finally {
      res.end();
    }
  })
);
