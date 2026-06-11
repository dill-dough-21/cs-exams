create extension if not exists pgcrypto;

create table if not exists public.presence_sessions (
  session_id uuid primary key default gen_random_uuid(),
  player_id text not null,
  path text not null default '/',
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create index if not exists presence_sessions_last_seen_idx
  on public.presence_sessions (last_seen desc);

create index if not exists presence_sessions_player_idx
  on public.presence_sessions (player_id, started_at desc);

create table if not exists public.quiz_sessions (
  session_id uuid primary key default gen_random_uuid(),
  player_id text not null,
  quiz_id text not null,
  quiz_name text not null,
  mode text not null default 'quiz',
  question_indices jsonb not null,
  question_count integer not null check (question_count > 0),
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create index if not exists quiz_sessions_active_idx
  on public.quiz_sessions (quiz_id, last_seen desc);

create index if not exists quiz_sessions_last_seen_idx
  on public.quiz_sessions (last_seen desc);

create index if not exists quiz_sessions_player_idx
  on public.quiz_sessions (player_id, started_at desc);

create table if not exists public.quiz_scores (
  id uuid primary key default gen_random_uuid(),
  quiz_id text not null,
  quiz_name text not null,
  player_id text not null,
  nickname text not null,
  score integer not null check (score >= 0),
  correct_count integer not null check (correct_count >= 0),
  total_questions integer not null check (total_questions > 0),
  duration_seconds integer not null check (duration_seconds >= 0),
  answers jsonb not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quiz_id, player_id),
  check (correct_count <= total_questions)
);

create index if not exists quiz_scores_quiz_rank_idx
  on public.quiz_scores (quiz_id, score desc, duration_seconds asc);

create index if not exists quiz_scores_player_idx
  on public.quiz_scores (player_id);

create table if not exists public.rate_limit_events (
  id bigserial primary key,
  endpoint text not null,
  rate_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_lookup_idx
  on public.rate_limit_events (endpoint, rate_key, created_at desc);

create or replace view public.overall_rankings as
select
  player_id,
  max(nickname) as nickname,
  sum(score)::integer as total_score,
  count(*)::integer as quizzes_count,
  max(updated_at) as last_updated
from public.quiz_scores
group by player_id;

alter table public.quiz_sessions enable row level security;
alter table public.quiz_scores enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.presence_sessions enable row level security;

-- API używa wyłącznie SUPABASE_SERVICE_ROLE_KEY po stronie Vercel.
-- Nie dodajemy publicznych polityk RLS dla anon key.
