# FlyVeda AI Server

The AI layer for the FlyVeda app — a standalone, provider-agnostic backend that powers:

1. **AI Teacher** — an aviation ground-instructor chat that grounds every answer in the FlyVeda syllabus and returns the topics it cited.
2. **Question Bank** — generates exam-style MCQs per syllabus topic and explains answers (the monetizable wedge).

It's a plain HTTP service, so your Expo/React Native app **and** the website call the same endpoints.

## Why it's built this way

- **Provider-agnostic by design:** all LLM calls go through one `LLMProvider` interface (`src/llm/types.ts`). The active provider is chosen by `LLM_PROVIDER` and resolved from a registry in `src/llm/client.ts`. **Claude (Anthropic) is the default.** Adding Sarvam or Llama later is a new file + one registry line — services and routes never change.
- **Grounded, not a raw wrapper:** `src/syllabus/syllabus.ts` is a curated aviation taxonomy (DGCA/ground-school subjects → topics). Answers and questions are anchored to topic codes (e.g. `NAV.3`). This is the defensible layer — swap the keyword retriever for vector RAG over licensed content later without touching the services.
- **Guardrails baked into prompts:** stays on-aviation, flags authority-dependent regs (DGCA/FAA/EASA), and refuses to invent regulatory figures.

## Setup

```bash
cd ai-server
npm install
cp .env.example .env   # then fill in ANTHROPIC_API_KEY
npm run dev            # http://localhost:8787
```

### Adding a provider later (Sarvam / Llama)

1. Create `src/llm/providers/<name>.ts` exporting a factory that returns an `LLMProvider`.
2. Register it in the `PROVIDERS` map in `src/llm/client.ts`.
3. Set `LLM_PROVIDER=<name>` and that provider's key in `.env`.

## Endpoints

All under `/api/ai`.

### `POST /teacher` — AI Teacher
```jsonc
{
  "messages": [{ "role": "user", "content": "Explain how a jet engine produces thrust" }],
  "goal": "CPL",          // optional: PPL | CPL | ATPL | DGCA
  "stream": true           // default true (SSE); false returns one JSON
}
```
- **Streaming (default):** Server-Sent Events — `meta` (citations) → many `delta` (text) → `done`.
- **Non-streaming:** `{ "answer": "...", "citations": [{ topicCode, topicTitle, subjectName, ... }] }`

### `POST /questions/generate` — make practice questions
```jsonc
{
  "topicCode": "NAV.3",    // or "topic": "free text"
  "goal": "CPL",
  "count": 5,               // 1–10
  "difficulty": "medium"    // easy | medium | hard
}
```
Returns `{ topic, questions: [{ question, options[4], correctIndex, explanation }] }`.

### `POST /questions/explain` — explain an answer
```jsonc
{
  "question": "…",
  "options": ["A", "B", "C", "D"],
  "correctIndex": 1,
  "selectedIndex": 3,       // optional — enables misconception-specific feedback
  "goal": "CPL"
}
```
Returns `{ "explanation": "…" }`.

### `GET /syllabus?goal=CPL` — taxonomy for onboarding/Library
Returns `{ subjects: [{ code, name, goals, topics: [...] }] }`.

### `GET /health`
Liveness + active model.

## Quick test

```bash
curl http://localhost:8787/health

curl -X POST http://localhost:8787/api/ai/questions/generate \
  -H "Content-Type: application/json" \
  -d '{"topicCode":"AERO.2","count":2,"difficulty":"easy"}'
```

## Where to go next

- Add auth (API key / JWT from your app's auth provider) before exposing publicly.
- Add rate limiting + per-user usage logging (you'll want this data for the Startup India pitch).
- Replace the keyword retriever in `syllabus.ts` with embeddings/vector search once you have real content.
- Persist generated questions so the same student doesn't see repeats.
