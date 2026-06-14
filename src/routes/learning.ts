import { Router } from "express";
import {
  detectSubjectSchema,
  explainMcqSchema,
  generateMcqsSchema,
} from "../schemas.js";
import { detectSubject } from "../services/subject-detection.js";
import { generateMcqs } from "../services/mcq.js";
import { explainMcqAnswer } from "../services/answer-explanation.js";
import { asyncHandler } from "../middleware/errors.js";

export const learningRouter = Router();

/**
 * POST /api/ai/detect-subject
 * Body: { question }
 * Returns: { subject, confidence }
 */
learningRouter.post(
  "/detect-subject",
  asyncHandler(async (req, res) => {
    const parsed = detectSubjectSchema.parse(req.body);
    const result = await detectSubject(parsed);
    res.json(result);
  })
);

/**
 * POST /api/ai/generate-mcqs
 * Body: { subject, topic?, difficulty?, question_count? }
 * Returns: { questions: [{ question, options[4], correct_answer, explanation }] }
 */
learningRouter.post(
  "/generate-mcqs",
  asyncHandler(async (req, res) => {
    const parsed = generateMcqsSchema.parse(req.body);
    const result = await generateMcqs(parsed);
    res.json(result);
  })
);

/**
 * POST /api/ai/explain-answer
 * Body: { question, options:{A,B,C,D}, correct_option, student_option? }
 * Returns: { correct_option, why_correct, why_incorrect, study_tip? }
 */
learningRouter.post(
  "/explain-answer",
  asyncHandler(async (req, res) => {
    const parsed = explainMcqSchema.parse(req.body);
    const result = await explainMcqAnswer(parsed);
    res.json(result);
  })
);
