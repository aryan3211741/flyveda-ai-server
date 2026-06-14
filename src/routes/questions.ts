import { Router } from "express";
import { explainAnswerSchema, generateQuestionsSchema } from "../schemas.js";
import { explainAnswer, generateQuestions } from "../services/questions.js";
import { asyncHandler } from "../middleware/errors.js";

export const questionsRouter = Router();

/**
 * POST /api/ai/questions/generate
 * Body: { topicCode? | topic?, goal?, count?, difficulty? }
 * Returns: { topic, questions: [{ question, options[4], correctIndex, explanation }] }
 */
questionsRouter.post(
  "/questions/generate",
  asyncHandler(async (req, res) => {
    const parsed = generateQuestionsSchema.parse(req.body);
    const result = await generateQuestions(parsed);
    res.json(result);
  })
);

/**
 * POST /api/ai/questions/explain
 * Body: { question, options[], correctIndex, selectedIndex?, goal? }
 * Returns: { explanation }
 */
questionsRouter.post(
  "/questions/explain",
  asyncHandler(async (req, res) => {
    const parsed = explainAnswerSchema.parse(req.body);
    const result = await explainAnswer(parsed);
    res.json(result);
  })
);
