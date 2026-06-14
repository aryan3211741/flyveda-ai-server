/**
 * Shared Prompt Layer — the single source of truth for FlyVeda's AI behaviour.
 *
 * Every AI learning route (subject detection, MCQ generation, answer explanation)
 * composes its system prompt from FLYVEDA_CORE_INSTRUCTION via `withCore()`, so the
 * voice, accuracy rules and exam alignment stay consistent across the product.
 *
 * (The existing /teacher endpoint keeps its own prompt and is intentionally not
 * touched here.)
 */

/** Canonical DGCA / CPL ground-subject set. Order is stable for the API contract. */
export const DGCA_SUBJECTS = [
  "Air Navigation",
  "Meteorology",
  "Air Regulations",
  "Technical General",
  "Technical Specific",
  "Aerodynamics",
] as const;

export type DgcaSubject = (typeof DGCA_SUBJECTS)[number];

/**
 * Scope notes per subject. These exist mainly to keep the classifier from
 * confusing the overlapping technical subjects, which is the most common error.
 */
export const SUBJECT_SCOPE: Record<DgcaSubject, string> = {
  "Air Navigation":
    "Charts and projections, the wind triangle, time/speed/distance, dead reckoning, compass and magnetism, 1-in-60 rule, RNAV/GNSS, flight planning and position fixing.",
  Meteorology:
    "The atmosphere and ISA, pressure and altimetry (QNH/QFE), temperature, wind, clouds and precipitation, icing, thunderstorms, fronts, visibility, and decoding METAR/TAF.",
  "Air Regulations":
    "Air law: ICAO Annexes, DGCA CARs, rules of the air, right-of-way, airspace classification, licensing/medicals, documents, and rules/procedures (not the physics).",
  "Technical General":
    "General aircraft engineering knowledge applicable to all types: airframe/structures, piston and gas-turbine engines, electrical, hydraulic, pneumatic and fuel systems, and flight instruments.",
  "Technical Specific":
    "Type-specific knowledge for the aircraft a student is rated on: that type's systems, limitations, performance figures, mass & balance and operating procedures.",
  Aerodynamics:
    "Principles of flight: the four forces, lift and drag generation, the lift/drag curve, stability and control, stalls and spins, high-lift devices, and load factor.",
};

/**
 * The common aviation instruction set. Keep this tight and authoritative — it is
 * prepended to every learning prompt.
 */
export const FLYVEDA_CORE_INSTRUCTION = `You are FlyVeda's aviation ground-instruction AI, built for Indian student pilots preparing for the DGCA CPL/ATPL ground examinations.

AUDIENCE & TONE
- Your students are CPL/ATPL aspirants. Be clear, patient and encouraging, like a good ground instructor.
- Use plain, simple language a student pilot can follow. Define jargon the first time it appears.

ACCURACY & SAFETY (non-negotiable)
- Be factually precise with definitions, figures and formulae. Never invent regulatory values or numbers.
- Default to DGCA / ICAO conventions. If a detail differs by authority (FAA/EASA), say so explicitly.
- If you are genuinely unsure of an exact figure, say so rather than guessing.
- Stay within aviation ground-school scope. Do not provide advice that could be unsafe if treated as a substitute for an authorised instructor or current official documents.

STYLE
- Be educational and well-structured: lead with the key point, then explain the "why".
- Prefer correct aviation units (kt, ft, nm, hPa, °C).
- Be concise and exam-relevant; avoid rambling.`;

/** Compose a route-specific instruction on top of the shared core. */
export function withCore(specificInstruction: string): string {
  return `${FLYVEDA_CORE_INSTRUCTION}\n\n---\n\n${specificInstruction}`;
}

/** A compact, model-readable description of the subject taxonomy for prompts. */
export function subjectCatalogText(): string {
  return DGCA_SUBJECTS.map((s) => `- ${s}: ${SUBJECT_SCOPE[s]}`).join("\n");
}
