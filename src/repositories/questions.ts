import type { SupabaseClient } from "../db/supabase.js";

export interface QuestionRow {
  id: string;
  user_id: string | null;
  subject: string;
  topic: string | null;
  difficulty: "easy" | "medium" | "hard";
  question: string;
  options: unknown;
  correct_answer: "A" | "B" | "C" | "D";
  explanation: string | null;
  created_at: string;
}

export interface NewQuestion {
  question: string;
  options: string[];
  correct_answer: "A" | "B" | "C" | "D";
  explanation?: string | null;
}

/** Persist a batch of generated MCQs, returning the stored rows (with ids). */
export async function saveQuestions(
  db: SupabaseClient,
  args: {
    userId: string | null;
    subject: string;
    topic?: string | null;
    difficulty: "easy" | "medium" | "hard";
    items: NewQuestion[];
  }
): Promise<QuestionRow[]> {
  if (args.items.length === 0) return [];
  const rows = args.items.map((q) => ({
    user_id: args.userId,
    subject: args.subject,
    topic: args.topic ?? null,
    difficulty: args.difficulty,
    question: q.question,
    options: q.options,
    correct_answer: q.correct_answer,
    explanation: q.explanation ?? null,
  }));
  const { data, error } = await db.from("questions").insert(rows).select();
  if (error) throw error;
  return (data as QuestionRow[]) ?? [];
}

/**
 * Questions the user has not yet attempted, drawn from their own bank plus the
 * shared pool (user_id null). Helps avoid showing repeats.
 */
export async function getUnseenQuestions(
  db: SupabaseClient,
  args: {
    userId: string;
    subject: string;
    limit?: number;
  }
): Promise<QuestionRow[]> {
  const limit = args.limit ?? 10;

  const { data: attempted, error: attErr } = await db
    .from("quiz_attempts")
    .select("question_id")
    .eq("user_id", args.userId)
    .not("question_id", "is", null);
  if (attErr) throw attErr;

  const seenIds = (attempted ?? [])
    .map((r: { question_id: string | null }) => r.question_id)
    .filter((id): id is string => Boolean(id));

  let query = db
    .from("questions")
    .select()
    .eq("subject", args.subject)
    .or(`user_id.eq.${args.userId},user_id.is.null`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (seenIds.length > 0) {
    query = query.not("id", "in", `(${seenIds.join(",")})`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as QuestionRow[]) ?? [];
}
