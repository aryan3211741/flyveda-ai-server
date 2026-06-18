import type { SupabaseClient } from "../db/supabase.js";

export interface TopicProgressRow {
  id: string;
  user_id: string;
  subject: string;
  topic_code: string;
  attempts: number;
  correct: number;
  mastery: number;
  last_studied_at: string;
}

/**
 * Records one attempt against a topic, recomputing mastery as the running
 * accuracy. Read-modify-write; acceptable for current per-user volumes.
 */
export async function recordTopicAttempt(
  db: SupabaseClient,
  args: {
    userId: string;
    subject: string;
    topicCode: string;
    isCorrect: boolean;
  }
): Promise<TopicProgressRow> {
  const { data: existing, error: readErr } = await db
    .from("topic_progress")
    .select()
    .eq("user_id", args.userId)
    .eq("subject", args.subject)
    .eq("topic_code", args.topicCode)
    .maybeSingle();
  if (readErr) throw readErr;

  const attempts = (existing?.attempts ?? 0) + 1;
  const correct = (existing?.correct ?? 0) + (args.isCorrect ? 1 : 0);
  const mastery = attempts > 0 ? Number((correct / attempts).toFixed(4)) : 0;

  const { data, error } = await db
    .from("topic_progress")
    .upsert(
      {
        user_id: args.userId,
        subject: args.subject,
        topic_code: args.topicCode,
        attempts,
        correct,
        mastery,
        last_studied_at: new Date().toISOString(),
      },
      { onConflict: "user_id,subject,topic_code" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as TopicProgressRow;
}

export async function getProgress(
  db: SupabaseClient,
  userId: string
): Promise<TopicProgressRow[]> {
  const { data, error } = await db
    .from("topic_progress")
    .select()
    .eq("user_id", userId)
    .order("subject", { ascending: true });
  if (error) throw error;
  return (data as TopicProgressRow[]) ?? [];
}
