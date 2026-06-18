import { Router } from "express";
import {
  detectSubjectSchema,
  explainMcqSchema,
  generateMcqsSchema,
  recordAttemptSchema,
  unseenQuestionsSchema,
} from "../schemas.js";
import { detectSubject } from "../services/subject-detection.js";
import { generateMcqs } from "../services/mcq.js";
import { explainMcqAnswer } from "../services/answer-explanation.js";
import { asyncHandler } from "../middleware/errors.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { saveQuestions, getUnseenQuestions } from "../repositories/questions.js";
import { recordAttempt } from "../repositories/quizzes.js";
import { recordTopicAttempt } from "../repositories/progress.js";
import { logUsage } from "../repositories/usage.js";
import { config } from "../config.js";
import { activeProviderName } from "../llm/client.js";

export const learningRouter = Router();

/**
 * POST /api/ai/detect-subject
 * Body: { question }
 * Returns: { subject, confidence }
 */
learningRouter.post(
  "/detect-subject",
  optionalAuth,
  rateLimit,
  asyncHandler(async (req, res) => {
    const parsed = detectSubjectSchema.parse(req.body);
    const result = await detectSubject(parsed);
    await logUsage(req.db, {
      userId: req.user?.id ?? null,
      endpoint: "detect-subject",
      provider: activeProviderName(),
      status: "ok",
    });
    res.json(result);
  })
);

/**
 * POST /api/ai/generate-mcqs
 * Body: { subject, topic?, difficulty?, question_count? }
 * Returns: { questions: [{ id?, question, options[4], correct_answer, explanation }] }
 * When authenticated, generated questions are saved to the user's question bank.
 */
learningRouter.post(
  "/generate-mcqs",
  optionalAuth,
  rateLimit,
  asyncHandler(async (req, res) => {
    const parsed = generateMcqsSchema.parse(req.body);
    const startedAt = Date.now();
    const result = await generateMcqs(parsed);

    let questions: Array<(typeof result.questions)[number] & { id?: string }> =
      result.questions;

    if (req.user && req.db) {
      const saved = await saveQuestions(req.db, {
        userId: req.user.id,
        subject: parsed.subject,
        topic: parsed.topic ?? null,
        difficulty: parsed.difficulty,
        items: result.questions.map((q) => ({
          question: q.question,
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
        })),
      });
      // Pair stored ids back onto the response in order.
      questions = result.questions.map((q, i) => ({ ...q, id: saved[i]?.id }));
    }

    await logUsage(req.db, {
      userId: req.user?.id ?? null,
      endpoint: "generate-mcqs",
      provider: activeProviderName(),
      model: config.llm.generationModel,
      latencyMs: Date.now() - startedAt,
      status: "ok",
    });
    res.json({ questions });
  })
);

/**
 * POST /api/ai/explain-answer
 * Body: { question, options:{A,B,C,D}, correct_option, student_option?, question_id?, subject?, topic_code? }
 * Returns: { correct_option, why_correct, why_incorrect, study_tip? }
 * When authenticated and student_option + subject/topic context are provided, the
 * attempt is recorded and topic progress updated.
 */
learningRouter.post(
  "/explain-answer",
  optionalAuth,
  rateLimit,
  asyncHandler(async (req, res) => {
    const parsed = explainMcqSchema.parse(req.body);
    const result = await explainMcqAnswer(parsed);

    if (req.user && req.db && parsed.student_option) {
      const isCorrect = parsed.student_option === parsed.correct_option;
      await recordAttempt(req.db, {
        userId: req.user.id,
        questionId: parsed.question_id ?? null,
        subject: parsed.subject ?? null,
        topicCode: parsed.topic_code ?? null,
        selectedAnswer: parsed.student_option,
        correctAnswer: parsed.correct_option,
        isCorrect,
      });
      if (parsed.subject && parsed.topic_code) {
        await recordTopicAttempt(req.db, {
          userId: req.user.id,
          subject: parsed.subject,
          topicCode: parsed.topic_code,
          isCorrect,
        });
      }
    }

    await logUsage(req.db, {
      userId: req.user?.id ?? null,
      endpoint: "explain-answer",
      provider: activeProviderName(),
      status: "ok",
    });
    res.json(result);
  })
);

/**
 * POST /api/ai/quiz/attempt  (auth required)
 * Body: { question_id?, subject?, topic_code?, selected_option, correct_option }
 * Records an answered question and updates topic progress. No LLM call.
 */
learningRouter.post(
  "/quiz/attempt",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = recordAttemptSchema.parse(req.body);
    const isCorrect = parsed.selected_option === parsed.correct_option;
    const attempt = await recordAttempt(req.db!, {
      userId: req.user!.id,
      questionId: parsed.question_id ?? null,
      subject: parsed.subject ?? null,
      topicCode: parsed.topic_code ?? null,
      selectedAnswer: parsed.selected_option,
      correctAnswer: parsed.correct_option,
      isCorrect,
    });
    if (parsed.subject && parsed.topic_code) {
      await recordTopicAttempt(req.db!, {
        userId: req.user!.id,
        subject: parsed.subject,
        topicCode: parsed.topic_code,
        isCorrect,
      });
    }
    res.json({ attempt, is_correct: isCorrect });
  })
);

/**
 * GET /api/ai/questions/unseen?subject=Meteorology&limit=10  (auth required)
 * Returns previously generated questions the user has not yet attempted.
 */
learningRouter.get(
  "/questions/unseen",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = unseenQuestionsSchema.parse(req.query);
    const questions = await getUnseenQuestions(req.db!, {
      userId: req.user!.id,
      subject: parsed.subject,
      limit: parsed.limit,
    });
    res.json({ questions });
  })
);
