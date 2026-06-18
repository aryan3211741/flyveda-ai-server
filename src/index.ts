import express from "express";
import cors from "cors";
import { config, isSupabaseConfigured, supabaseMode } from "./config.js";
import { activeFallbackName, activeModel, activeProviderName } from "./llm/client.js";
import { errorHandler } from "./middleware/errors.js";
import { teacherRouter } from "./routes/teacher.js";
import { questionsRouter } from "./routes/questions.js";
import { syllabusRouter } from "./routes/syllabus.js";
import { learningRouter } from "./routes/learning.js";
import { accountRouter } from "./routes/account.js";
import { chatRouter } from "./routes/chat.js";

const app = express();

app.use(
  cors({
    origin: config.corsOrigins.includes("*") ? true : config.corsOrigins,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.json({
    name: "FlyVeda AI Server",
    ok: true,
    endpoints: {
      health: "GET /health",
      chat: "POST /api/ai/chat  { message, history?, goal? }",
      teacher: "POST /api/ai/teacher",
      generateMcqs: "POST /api/ai/generate-mcqs",
    },
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    provider: activeProviderName(),
    model: activeModel(),
    fallback: activeFallbackName(),
    database: isSupabaseConfigured() ? "supabase" : "disabled",
    databaseMode: supabaseMode(),
  });
});

app.use("/api/ai", chatRouter);
app.use("/api/ai", teacherRouter);
app.use("/api/ai", questionsRouter);
app.use("/api/ai", syllabusRouter);
app.use("/api/ai", learningRouter);
app.use("/api/ai", accountRouter);

app.use(errorHandler);

// Bind 0.0.0.0 so cloud hosts (Render, Railway, etc.) can route traffic in.
app.listen(config.port, "0.0.0.0", () => {
  console.log(`FlyVeda AI server listening on port ${config.port}`);
  const fallback = activeFallbackName();
  console.log(
    `  provider: ${activeProviderName()}  model: ${activeModel()}` +
      (fallback ? `  fallback: ${fallback}` : "")
  );
  const dbMsg = {
    service_role: "supabase (service_role, persistence on)",
    anon: "supabase (anon + user JWT, RLS-enforced, persistence on)",
    disabled: "disabled (set SUPABASE_URL + SUPABASE_ANON_KEY or SERVICE_ROLE_KEY)",
  }[supabaseMode()];
  console.log(`  database: ${dbMsg}`);
});
