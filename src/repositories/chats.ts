import type { SupabaseClient } from "../db/supabase.js";

export interface ChatSession {
  id: string;
  user_id: string;
  title: string | null;
  goal: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: unknown;
  created_at: string;
}

export async function createSession(
  db: SupabaseClient,
  userId: string,
  opts: { title?: string | null; goal?: string | null } = {}
): Promise<ChatSession> {
  const { data, error } = await db
    .from("chat_sessions")
    .insert({ user_id: userId, title: opts.title ?? null, goal: opts.goal ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as ChatSession;
}

export async function getSession(
  db: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<ChatSession | null> {
  const { data, error } = await db
    .from("chat_sessions")
    .select()
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as ChatSession) ?? null;
}

export async function listSessions(
  db: SupabaseClient,
  userId: string
): Promise<ChatSession[]> {
  const { data, error } = await db
    .from("chat_sessions")
    .select()
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as ChatSession[]) ?? [];
}

/** Bump updated_at (and optionally set a title once) after a new turn. */
export async function touchSession(
  db: SupabaseClient,
  sessionId: string,
  patch: { title?: string } = {}
): Promise<void> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title) update.title = patch.title;
  const { error } = await db.from("chat_sessions").update(update).eq("id", sessionId);
  if (error) throw error;
}

export async function appendMessage(
  db: SupabaseClient,
  args: {
    sessionId: string;
    userId: string;
    role: "user" | "assistant" | "system";
    content: string;
    citations?: unknown;
  }
): Promise<ChatMessageRow> {
  const { data, error } = await db
    .from("chat_messages")
    .insert({
      session_id: args.sessionId,
      user_id: args.userId,
      role: args.role,
      content: args.content,
      citations: args.citations ?? [],
    })
    .select()
    .single();
  if (error) throw error;
  return data as ChatMessageRow;
}

export async function getMessages(
  db: SupabaseClient,
  sessionId: string
): Promise<ChatMessageRow[]> {
  const { data, error } = await db
    .from("chat_messages")
    .select()
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as ChatMessageRow[]) ?? [];
}
