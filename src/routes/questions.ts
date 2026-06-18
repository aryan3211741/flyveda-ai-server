import { Router } from "express";
import { explainAnswerSchema, generateQuestionsSchema } from "../schemas.js";
import { explainAnswer, generateQuestions } from "../services/questions.js";
import { asyncHandler } from "../middleware/errors.js";
import { optionalAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { saveQuestions } from "../repositories/questions.js";
import { logUsage } from "../repositories/usage.js";
import { config } from "../config.js";
import { activeProviderName } from "../llm/client.js";

export const questionsRouter = Router();

const LETTERS = ["A", "B", "C", "D"] as const;

/**
 * POST /api/ai/questions/generate
 * Body: { topicCode? | topic?, goal?, count?, difficulty? }
 * Returns: { topic, questions: [{ id?, question, options[4], correctIndex, explanation }] }
 * When authenticated, questions are saved to the user's question bank.
 */
questionsRouter.post(
  "/questions/generate",
  optionalAuth,
  rateLimit,
  asyncHandler(async (req, res) => {
    const parsed = generateQuestionsSchema.parse(req.body);
    const startedAt = Date.now();
    const result = await generateQuestions(parsed);

    let questions: Array<(typeof result.questions)[number] & { id?: string }> =
      result.questions;

    if (req.user && req.db) {
      const subject = result.topic?.subjectName ?? parsed.topic ?? "General";
      const topicLabel = result.topic?.topicCode ?? parsed.topicCode ?? parsed.topic ?? null;
      const saved = await saveQuestions(req.db, {
        userId: req.user.id,
        subject,
        topic: topicLabel,
        difficulty: parsed.difficulty,
        items: result.questions.map((q) => ({
          question: q.question,
          options: q.options,
          correct_answer: LETTERS[q.correctIndex] ?? "A",
          explanation: q.explanation,
        })),
      });
      questions = result.questions.map((q, i) => ({ ...q, id: saved[i]?.id }));
    }

    await logUsage(req.db, {
      userId: req.user?.id ?? null,
      endpoint: "questions/generate",
      provider: activeProviderName(),
      model: config.llm.generationModel,
      latencyMs: Date.now() - startedAt,
      status: "ok",
    });
    res.json({ topic: result.topic, questions });
  })
);

/**
 * POST /api/ai/questions/explain
 * Body: { question, options[], correctIndex, selectedIndex?, goal? }
 * Returns: { explanation }
 */
questionsRouter.post(
  "/questions/explain",
  optionalAuth,
  rateLimit,
  asyncHandler(async (req, res) => {
    const parsed = explainAnswerSchema.parse(req.body);
    const result = await explainAnswer(parsed);
    await logUsage(req.db, {
      userId: req.user?.id ?? null,
      endpoint: "questions/explain",
      provider: activeProviderName(),
      status: "ok",
    });
    res.json(result);
  })
);
