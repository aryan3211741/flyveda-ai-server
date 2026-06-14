import { chatJson, type ChatMessage } from "../llm/client.js";
import { withCore } from "../llm/aviation-core.js";
import {
  answerExplanationResultSchema,
  type ExplainMcqRequest,
} from "../schemas.js";

export interface AnswerExplanation {
  correct_option: "A" | "B" | "C" | "D";
  why_correct: string;
  why_incorrect: Record<string, string>;
  study_tip?: string;
}

const SYSTEM = withCore(`TASK: Explain a multiple-choice answer to a student pilot.

WHAT TO PRODUCE
- "why_correct": explain clearly WHY the correct option is correct.
- "why_incorrect": an object keyed by the OTHER option letters, each explaining the specific reason/misconception that makes that option wrong. Do NOT include the correct option's letter here.
- "study_tip" (optional): one short memory aid or rule of thumb.

STYLE
- Simple language for a student pilot. Be encouraging and educational.
- Each explanation is concise (1–3 sentences). Be accurate; flag any authority-dependent detail.

Respond with ONLY this JSON, no prose, no markdown:
{
  "correct_option": "A",
  "why_correct": "string",
  "why_incorrect": { "B": "string", "C": "string", "D": "string" },
  "study_tip": "string"
}`);

export async function explainMcqAnswer(
  req: ExplainMcqRequest
): Promise<AnswerExplanation> {
  const optionsText = (["A", "B", "C", "D"] as const)
    .map((k) => `${k}. ${req.options[k]}`)
    .join("\n");

  const studentLine =
    req.student_option !== undefined
      ? req.student_option === req.correct_option
        ? "The student chose the correct option."
        : `The student chose option ${req.student_option} (incorrect) — address that misconception directly in why_incorrect.`
      : "The student has not selected an option yet.";

  const userPrompt = `Question: ${req.question}
Options:
${optionsText}

Correct option: ${req.correct_option}
${studentLine}

Explain it.`;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: userPrompt },
  ];

  const raw = await chatJson(messages, { temperature: 0.3 });
  return answerExplanationResultSchema.parse(raw);
}
