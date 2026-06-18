import type { SupabaseClient } from "../db/supabase.js";

export interface QuizAttemptRow {
  id: string;
  user_id: string;
  question_id: string | null;
  subject: string | null;
  topic_code: string | null;
  selected_answer: "A" | "B" | "C" | "D" | null;
  correct_answer: "A" | "B" | "C" | "D" | null;
  is_correct: boolean;
  created_at: string;
}

export async function recordAttempt(
  db: SupabaseClient,
  args: {
    userId: string;
    questionId?: string | null;
    subject?: string | null;
    topicCode?: string | null;
    selectedAnswer?: "A" | "B" | "C" | "D" | null;
    correctAnswer?: "A" | "B" | "C" | "D" | null;
    isCorrect: boolean;
  }
): Promise<QuizAttemptRow> {
  const { data, error } = await db
    .from("quiz_attempts")
    .insert({
      user_id: args.userId,
      question_id: args.questionId ?? null,
      subject: args.subject ?? null,
      topic_code: args.topicCode ?? null,
      selected_answer: args.selectedAnswer ?? null,
      correct_answer: args.correctAnswer ?? null,
      is_correct: args.isCorrect,
    })
    .select()
    .single();
  if (error) throw error;
  return data as QuizAttemptRow;
}

export async function listAttempts(
  db: SupabaseClient,
  userId: string,
  limit = 50
): Promise<QuizAttemptRow[]> {
  const { data, error } = await db
    .from("quiz_attempts")
    .select()
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as QuizAttemptRow[]) ?? [];
}
