import { Router } from "express";
import { getSubjectsForGoal } from "../syllabus/syllabus.js";
import { goalSchema } from "../schemas.js";

export const syllabusRouter = Router();

/**
 * GET /api/ai/syllabus?goal=CPL
 * Returns the subject + topic taxonomy, optionally filtered by goal.
 * Used by the app's onboarding (goal picker) and Library screens.
 */
syllabusRouter.get("/syllabus", (req, res) => {
  const goalParam = req.query.goal;
  const goal =
    typeof goalParam === "string" ? goalSchema.optional().parse(goalParam) : undefined;
  res.json({ subjects: getSubjectsForGoal(goal) });
});
