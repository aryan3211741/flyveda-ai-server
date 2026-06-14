import { chatJson, type ChatMessage } from "../llm/client.js";
import { subjectCatalogText, withCore } from "../llm/aviation-core.js";
import {
  subjectDetectionResultSchema,
  type DetectSubjectRequest,
} from "../schemas.js";

export interface SubjectDetection {
  subject: string;
  confidence: number;
}

const SYSTEM = withCore(`TASK: Subject classification.
Classify the student's question into exactly ONE of the FlyVeda DGCA ground subjects below.

SUBJECTS
${subjectCatalogText()}

RULES
- Choose the single best-fit subject. Use the scope notes to resolve overlaps:
  * Physics of flight (lift, drag, stall, stability) => "Aerodynamics", not "Technical General".
  * Aircraft hardware/systems/engines/instruments => "Technical General".
  * A specific aircraft type's systems/limits/performance => "Technical Specific".
  * Rules/law/licensing/airspace => "Air Regulations" (even if it mentions a physical concept).
- "confidence" is your calibrated certainty from 0 to 1 (use lower values when the question is ambiguous or spans subjects).

Respond with ONLY this JSON, no prose:
{ "subject": "<one of the listed subjects, verbatim>", "confidence": 0.0 }`);

export async function detectSubject(
  req: DetectSubjectRequest
): Promise<SubjectDetection> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: req.question },
  ];

  const raw = await chatJson(messages, { temperature: 0 });
  return subjectDetectionResultSchema.parse(raw);
}
