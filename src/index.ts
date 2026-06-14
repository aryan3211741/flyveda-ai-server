import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { activeFallbackName, activeModel, activeProviderName } from "./llm/client.js";
import { errorHandler } from "./middleware/errors.js";
import { teacherRouter } from "./routes/teacher.js";
import { questionsRouter } from "./routes/questions.js";
import { syllabusRouter } from "./routes/syllabus.js";
import { learningRouter } from "./routes/learning.js";

const app = express();

app.use(
  cors({
    origin: config.corsOrigins.includes("*") ? true : config.corsOrigins,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    provider: activeProviderName(),
    model: activeModel(),
    fallback: activeFallbackName(),
  });
});

app.use("/api/ai", teacherRouter);
app.use("/api/ai", questionsRouter);
app.use("/api/ai", syllabusRouter);
app.use("/api/ai", learningRouter);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`FlyVeda AI server listening on http://localhost:${config.port}`);
  const fallback = activeFallbackName();
  console.log(
    `  provider: ${activeProviderName()}  model: ${activeModel()}` +
      (fallback ? `  fallback: ${fallback}` : "")
  );
});
