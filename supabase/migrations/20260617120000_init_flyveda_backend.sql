-- FlyVeda backend schema: profiles, chat history, question bank, quiz attempts,
-- learning progress, and usage events. All tables live in the `public` schema
-- with RLS enabled. The AI server connects with the service_role key (which
-- bypasses RLS) for trusted writes; the policies below exist as defense-in-depth
-- and to allow the app to read its own rows directly if it ever does.

-- ---------------------------------------------------------------------------
-- Helper triggers
-- ---------------------------------------------------------------------------

-- Keep updated_at fresh on row updates.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  goal         text check (goal in ('PPL', 'CPL', 'ATPL', 'DGCA')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- This project may have been created by another tool (e.g. Lovable) that already
-- manages `profiles` and a signup trigger. To stay non-destructive:
--   * `create table if not exists` above never overwrites an existing table.
--   * add the `goal` column only if missing.
--   * install the signup trigger ONLY if no insert trigger already exists on
--     auth.users (so we never clobber an existing profile-creation flow).
alter table public.profiles add column if not exists goal text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and not tgisinternal
      and (tgtype & 4) = 4  -- INSERT triggers (bit 2 of tgtype)
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- chat_sessions  (one Teacher conversation)
-- ---------------------------------------------------------------------------
create table if not exists public.chat_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text,
  goal       text check (goal in ('PPL', 'CPL', 'ATPL', 'DGCA')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_chat_sessions_user
  on public.chat_sessions (user_id, updated_at desc);

drop trigger if exists trg_chat_sessions_updated_at on public.chat_sessions;
create trigger trg_chat_sessions_updated_at
  before update on public.chat_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- chat_messages  (turns within a session)
-- ---------------------------------------------------------------------------
create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('user', 'assistant', 'system')),
  content    text not null,
  citations  jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_session
  on public.chat_messages (session_id, created_at);

-- ---------------------------------------------------------------------------
-- questions  (persistent question bank; user_id null = shared)
-- ---------------------------------------------------------------------------
create table if not exists public.questions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users (id) on delete set null,
  subject        text not null,
  topic          text,
  difficulty     text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  question       text not null,
  options        jsonb not null,
  correct_answer text not null check (correct_answer in ('A', 'B', 'C', 'D')),
  explanation    text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_questions_user_subject
  on public.questions (user_id, subject, created_at desc);
create index if not exists idx_questions_subject_difficulty
  on public.questions (subject, difficulty);

-- ---------------------------------------------------------------------------
-- quiz_attempts  (one answered question)
-- ---------------------------------------------------------------------------
create table if not exists public.quiz_attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  question_id     uuid references public.questions (id) on delete set null,
  subject         text,
  topic_code      text,
  selected_answer text check (selected_answer in ('A', 'B', 'C', 'D')),
  correct_answer  text check (correct_answer in ('A', 'B', 'C', 'D')),
  is_correct      boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists idx_quiz_attempts_user
  on public.quiz_attempts (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- topic_progress  (rolled-up mastery per topic)
-- ---------------------------------------------------------------------------
create table if not exists public.topic_progress (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  subject         text not null,
  topic_code      text not null,
  attempts        integer not null default 0,
  correct         integer not null default 0,
  mastery         numeric not null default 0,
  last_studied_at timestamptz not null default now(),
  unique (user_id, subject, topic_code)
);

create index if not exists idx_topic_progress_user
  on public.topic_progress (user_id);

-- ---------------------------------------------------------------------------
-- usage_events  (one AI call; drives usage metrics + rate limiting)
-- ---------------------------------------------------------------------------
create table if not exists public.usage_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete set null,
  endpoint   text not null,
  provider   text,
  model      text,
  tokens_in  integer,
  tokens_out integer,
  latency_ms integer,
  status     text,
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_events_user
  on public.usage_events (user_id, created_at desc);
create index if not exists idx_usage_events_created
  on public.usage_events (created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.questions     enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.topic_progress enable row level security;
alter table public.usage_events  enable row level security;

-- profiles: a user can see and edit only their own profile.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- chat_sessions
drop policy if exists "chat_sessions_rw_own" on public.chat_sessions;
create policy "chat_sessions_rw_own" on public.chat_sessions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- chat_messages
drop policy if exists "chat_messages_rw_own" on public.chat_messages;
create policy "chat_messages_rw_own" on public.chat_messages
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- questions: read own + shared (user_id null); write only own.
drop policy if exists "questions_select_own_or_shared" on public.questions;
create policy "questions_select_own_or_shared" on public.questions
  for select to authenticated using (auth.uid() = user_id or user_id is null);
drop policy if exists "questions_insert_own" on public.questions;
create policy "questions_insert_own" on public.questions
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "questions_update_own" on public.questions;
create policy "questions_update_own" on public.questions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "questions_delete_own" on public.questions;
create policy "questions_delete_own" on public.questions
  for delete to authenticated using (auth.uid() = user_id);

-- quiz_attempts
drop policy if exists "quiz_attempts_rw_own" on public.quiz_attempts;
create policy "quiz_attempts_rw_own" on public.quiz_attempts
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- topic_progress
drop policy if exists "topic_progress_rw_own" on public.topic_progress;
create policy "topic_progress_rw_own" on public.topic_progress
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- usage_events: a user may read and insert their own. (When the server uses the
-- service_role key these policies are bypassed; the insert policy is what allows
-- the anon-key + forwarded-JWT mode to log usage under RLS.)
drop policy if exists "usage_events_select_own" on public.usage_events;
create policy "usage_events_select_own" on public.usage_events
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "usage_events_insert_own" on public.usage_events;
create policy "usage_events_insert_own" on public.usage_events
  for insert to authenticated with check (auth.uid() = user_id);
