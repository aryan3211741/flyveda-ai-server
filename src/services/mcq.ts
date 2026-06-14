import { config } from "../config.js";
import { chatJson, type ChatMessage } from "../llm/client.js";
import { SUBJECT_SCOPE, withCore, type DgcaSubject } from "../llm/aviation-core.js";
import { mcqEnvelopeSchema, type GenerateMcqsRequest } from "../schemas.js";

export interface Mcq {
  question: string;
  /** Ordered array of four answer texts. */
  options: string[];
  /** Letter (A–D) marking which option, by position, is correct (A = first). */
  correct_answer: "A" | "B" | "C" | "D";
  explanation: string;
}

export interface GenerateMcqsResult {
  questions: Mcq[];
}

const SYSTEM = withCore(`TASK: Author DGCA-style multiple-choice questions for ground-school practice.

QUESTION STYLE (most important)
- Write APPLICATION-level questions, not definition recall. Strongly prefer:
  * SCENARIO-BASED: put the student in a realistic flight situation (a given route/leg, weather, aircraft state, ATC instruction, instrument indication, phase of flight) and ask what applies, what happens, or what the correct action is.
  * CALCULATION-BASED: require a numerical working using realistic figures — e.g. heading/groundspeed/ETA (wind triangle, 1-in-60), TAS/IAS/density-altitude corrections, fuel and endurance, mass & balance, pressure/temperature/altimetry, climb/descent gradients, performance. Choose numbers that produce a clean, checkable answer, and make distractors the results of classic mistakes (wrong sign of variation, forgot to convert units, used IAS instead of TAS, added instead of subtracted, etc.).
- AVOID "What is X?" / "Define X" / "Which of the following is the definition of X" style questions. Do not use them unless the concept genuinely cannot be tested any other way.
- Test understanding and decision-making, reasoning from principles, and interpretation of data/diagrams described in words.

QUESTION RULES
- Each question has exactly four options provided as an ordered array of answer texts.
- "correct_answer" is the letter "A", "B", "C" or "D" identifying which option is correct by position (A = first option, B = second, and so on). Exactly one is correct.
- Write in the style and rigour of DGCA / CPL ground examinations.
- Distractors must be plausible and reflect common student misconceptions or common calculation errors — never obviously wrong or joke options.
- Stems are clear and self-contained: include every figure/assumption needed to solve them. Avoid "all/none of the above" and double negatives.
- Match the requested difficulty (harder = more steps, more interacting variables, less obvious distractors).
- For calculation questions, "explanation" must show the key working/steps, not just state the result. For scenario questions, explain the reasoning that leads to the correct action.
- Be factually correct and use DGCA/ICAO conventions and standard aviation units (kt, ft, nm, hPa, °C).

Respond with ONLY this JSON, no prose, no markdown:
{
  "questions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correct_answer": "A",
      "explanation": "string"
    }
  ]
}`);

export async function generateMcqs(
  req: GenerateMcqsRequest
): Promise<GenerateMcqsResult> {
  const subject = req.subject as DgcaSubject;
  const topicLine = req.topic
    ? `Focus topic within the subject: ${req.topic}.`
    : "Cover representative topics across the subject.";

  const userPrompt = `Generate ${req.question_count} ${req.difficulty} DGCA-style MCQs.
Subject: ${subject}
Subject scope: ${SUBJECT_SCOPE[subject]}
${topicLine}`;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: userPrompt },
  ];

  const raw = await chatJson(messages, {
    model: config.llm.generationModel,
    temperature: 0.7,
    // MCQs with worked explanations are token-heavy; scale the budget with the
    // requested count so the JSON is never truncated (was hitting max_tokens).
    maxTokens: Math.min(8000, 1000 + req.question_count * 600),
  });

  const parsed = mcqEnvelopeSchema.parse(raw);
  return { questions: parsed.questions };
}
