import { config } from "../config.js";
import { chat, chatJson, type ChatMessage } from "../llm/client.js";
import { EXPLANATION_SYSTEM, QUESTION_GEN_SYSTEM } from "../llm/prompts.js";
import {
  findTopicByCode,
  retrieveTopics,
  type Goal,
  type RetrievedTopic,
} from "../syllabus/syllabus.js";
import {
  generatedQuestionsEnvelopeSchema,
  type ExplainAnswerRequest,
  type GenerateQuestionsRequest,
} from "../schemas.js";

export interface GeneratedQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface GenerateResult {
  topic: RetrievedTopic | null;
  questions: GeneratedQuestion[];
}

function resolveTopic(req: GenerateQuestionsRequest): RetrievedTopic | null {
  if (req.topicCode) {
    const byCode = findTopicByCode(req.topicCode);
    if (byCode) return byCode;
  }
  if (req.topic) {
    const [best] = retrieveTopics(req.topic, req.goal as Goal | undefined, 1);
    if (best) return best;
  }
  return null;
}

export async function generateQuestions(
  req: GenerateQuestionsRequest
): Promise<GenerateResult> {
  const topic = resolveTopic(req);
  const topicLabel = topic
    ? `${topic.subjectName} → ${topic.topicTitle} (${topic.topicCode}). Scope: ${topic.summary}`
    : req.topic ?? "general aviation ground school";

  const goalLine = req.goal
    ? `Target exam level: ${req.goal}.`
    : "Target exam level: general ground school.";

  const userPrompt = `Write ${req.count} ${req.difficulty} multiple-choice questions.
Topic: ${topicLabel}
${goalLine}

Return JSON of exactly this shape:
{
  "questions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctIndex": 0,
      "explanation": "string — why the correct option is right"
    }
  ]
}
Each question must have exactly 4 options and exactly one correct answer.`;

  const messages: ChatMessage[] = [
    { role: "system", content: QUESTION_GEN_SYSTEM },
    { role: "user", content: userPrompt },
  ];

  const raw = await chatJson(messages, {
    model: config.llm.generationModel,
    temperature: 0.7,
  });

  const parsed = generatedQuestionsEnvelopeSchema.parse(raw);
  return { topic, questions: parsed.questions };
}

export async function explainAnswer(
  req: ExplainAnswerRequest
): Promise<{ explanation: string }> {
  const correct = req.options[req.correctIndex];
  const selected =
    req.selectedIndex !== undefined ? req.options[req.selectedIndex] : undefined;
  const wasCorrect = req.selectedIndex === req.correctIndex;

  const goalLine = req.goal ? ` The student is preparing for the ${req.goal}.` : "";

  const userPrompt = `Question: ${req.question}
Options:
${req.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n")}

Correct answer: ${String.fromCharCode(65 + req.correctIndex)}. ${correct}
${
    selected !== undefined
      ? wasCorrect
        ? "The student chose the correct answer."
        : `The student chose: ${String.fromCharCode(65 + req.selectedIndex!)}. ${selected}`
      : "The student has not answered yet."
  }${goalLine}

Explain it.`;

  const messages: ChatMessage[] = [
    { role: "system", content: EXPLANATION_SYSTEM },
    { role: "user", content: userPrompt },
  ];

  const explanation = await chat(messages, { temperature: 0.4 });
  return { explanation };
}
