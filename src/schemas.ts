import { z } from "zod";
import { DGCA_SUBJECTS } from "./llm/aviation-core.js";

export const goalSchema = z.enum(["PPL", "CPL", "ATPL", "DGCA"]);

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const teacherRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(40),
  goal: goalSchema.optional(),
  /** When true (default) responds via SSE stream; false returns one JSON payload. */
  stream: z.boolean().optional().default(true),
});
export type TeacherRequest = z.infer<typeof teacherRequestSchema>;

export const generateQuestionsSchema = z.object({
  /** Either a syllabus topic code (e.g. "NAV.3") or a free-text topic. */
  topicCode: z.string().optional(),
  topic: z.string().optional(),
  goal: goalSchema.optional(),
  count: z.number().int().min(1).max(10).optional().default(5),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium"),
});
export type GenerateQuestionsRequest = z.infer<typeof generateQuestionsSchema>;

export const explainAnswerSchema = z.object({
  question: z.string().min(1).max(2000),
  options: z.array(z.string().min(1)).min(2).max(6),
  correctIndex: z.number().int().min(0),
  selectedIndex: z.number().int().min(0).optional(),
  goal: goalSchema.optional(),
});
export type ExplainAnswerRequest = z.infer<typeof explainAnswerSchema>;

/** Shape the model must return for a generated MCQ (validated post-generation). */
export const generatedQuestionSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1),
});
export const generatedQuestionsEnvelopeSchema = z.object({
  questions: z.array(generatedQuestionSchema).min(1),
});

/* ------------------------------------------------------------------ *
 * Core AI learning layer (DGCA/CPL): detect-subject, generate-mcqs,
 * explain-answer. The schemas below back the three new endpoints.
 * ------------------------------------------------------------------ */

export const subjectSchema = z.enum(DGCA_SUBJECTS);
export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export const optionKeySchema = z.enum(["A", "B", "C", "D"]);
const optionsSchema = z.object({
  A: z.string().min(1),
  B: z.string().min(1),
  C: z.string().min(1),
  D: z.string().min(1),
});

/* ---- 1. Subject detection ---- */
export const detectSubjectSchema = z.object({
  question: z.string().min(3).max(2000),
});
export type DetectSubjectRequest = z.infer<typeof detectSubjectSchema>;

/** Validated shape returned by the model for classification. */
export const subjectDetectionResultSchema = z.object({
  subject: subjectSchema,
  confidence: z.number().min(0).max(1),
});

/* ---- 2. MCQ generation ---- */
export const generateMcqsSchema = z.object({
  subject: subjectSchema,
  topic: z.string().min(2).max(200).optional(),
  difficulty: difficultySchema.optional().default("medium"),
  question_count: z.number().int().min(1).max(15).optional().default(5),
});
export type GenerateMcqsRequest = z.infer<typeof generateMcqsSchema>;

/**
 * Validated shape for each model-generated MCQ.
 * `options` is an ordered array of four answer texts; `correct_answer` is the
 * letter (A–D) whose position in that array is correct (A = first).
 */
export const mcqItemSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correct_answer: optionKeySchema,
  explanation: z.string().min(1),
});
export const mcqEnvelopeSchema = z.object({
  questions: z.array(mcqItemSchema).min(1),
});

/* ---- 3. Answer explanation ---- */
export const explainMcqSchema = z.object({
  question: z.string().min(1).max(2000),
  options: optionsSchema,
  correct_option: optionKeySchema,
  /** What the student picked (optional) — enables targeted feedback. */
  student_option: optionKeySchema.optional(),
});
export type ExplainMcqRequest = z.infer<typeof explainMcqSchema>;

/** Validated shape returned by the model for an explanation. */
export const answerExplanationResultSchema = z.object({
  correct_option: optionKeySchema,
  why_correct: z.string().min(1),
  why_incorrect: z.record(z.string(), z.string()),
  study_tip: z.string().optional(),
});
