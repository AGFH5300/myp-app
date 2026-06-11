-- MYP Atlas Phase 1 rebuild schema
-- Scope: real MYP eAssessment papers, questions, markschemes (2016-2025).

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text unique,
  full_name text,
  role text not null default 'student' check (role in ('student', 'admin')),
  myp_year integer check (myp_year between 4 and 5),
  school text,
  selected_subject_ids uuid[] not null default '{}',
  practice_focus text,
  preferred_session text check (preferred_session in ('May', 'November')),
  preferred_year integer check (preferred_year between 2016 and 2025),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.student_subjects (
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, subject_id)
);

create table if not exists public.exam_sessions (
  id uuid primary key default gen_random_uuid(),
  session_month text not null check (session_month in ('May', 'November')),
  session_year integer not null check (session_year between 2016 and 2025),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  unique (session_month, session_year)
);

create table if not exists public.papers (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete restrict,
  exam_session_id uuid references public.exam_sessions(id) on delete set null,
  title text not null,
  year integer not null check (year between 2016 and 2025),
  paper_code text,
  timezone text,
  pdf_url text,
  markscheme_url text,
  markscheme_text text,
  is_published boolean not null default false,
  source_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  question_number text not null,
  prompt_text text not null,
  image_url text,
  marks integer,
  answer_mode text,
  options_json jsonb,
  markscheme_text text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (paper_id, question_number)
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.question_topics (
  question_id uuid not null references public.questions(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  primary key (question_id, topic_id)
);

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  paper_id uuid references public.papers(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (paper_id is not null or question_id is not null),
  unique (student_id, paper_id, question_id)
);

create table if not exists public.paper_views (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  paper_id uuid not null references public.papers(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create table if not exists public.recent_question_views (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  answer_text text,
  score integer,
  max_score integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_username on public.profiles(username);
create unique index if not exists profiles_username_lower_unique on public.profiles (lower(trim(username))) where username is not null and trim(username) <> '';
create unique index if not exists profiles_email_lower_unique on public.profiles (lower(trim(email))) where email is not null and trim(email) <> '';
create index if not exists idx_papers_subject_year on public.papers(subject_id, year desc);
create index if not exists idx_papers_exam_session on public.papers(exam_session_id);
create index if not exists idx_questions_paper on public.questions(paper_id);
create index if not exists idx_questions_published on public.questions(is_published);
create index if not exists idx_bookmarks_student on public.bookmarks(student_id, created_at desc);
create index if not exists idx_paper_views_student on public.paper_views(student_id, viewed_at desc);
create index if not exists idx_recent_question_views_student on public.recent_question_views(student_id, viewed_at desc);
create index if not exists idx_attempts_student on public.attempts(student_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_email text := lower(trim(coalesce(new.email, '')));
  metadata_username text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'username', '')), '');
  safe_username text := null;
  metadata_full_name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
begin
  if metadata_username is not null
    and metadata_username ~ '^[a-zA-Z0-9_]{3,24}$'
    and not exists (
      select 1
      from public.profiles
      where lower(trim(username)) = lower(metadata_username)
        and id <> new.id
    )
    and not exists (
      select 1
      from auth.users
      where lower(trim(coalesce(raw_user_meta_data ->> 'username', ''))) = lower(metadata_username)
        and id <> new.id
    ) then
    safe_username := metadata_username;
  end if;

  insert into public.profiles (id, email, full_name, username)
  values (
    new.id,
    nullif(normalized_email, ''),
    coalesce(metadata_full_name, split_part(normalized_email, '@', 1)),
    safe_username
  )
  on conflict (id) do update
  set email = coalesce(nullif(excluded.email, ''), public.profiles.email),
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      username = coalesce(public.profiles.username, excluded.username);

  return new;
end;
$$;

create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with normalized as (
    select trim(coalesce(p_username, '')) as username
  )
  select case
    when normalized.username = '' or normalized.username !~ '^[a-zA-Z0-9_]{3,24}$' then false
    else not exists (
      select 1
      from public.profiles
      where lower(trim(username)) = lower(normalized.username)
    ) and not exists (
      select 1
      from auth.users
      where lower(trim(coalesce(raw_user_meta_data ->> 'username', ''))) = lower(normalized.username)
    )
  end
  from normalized;
$$;

create or replace function public.is_email_available(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with normalized as (
    select lower(trim(coalesce(p_email, ''))) as email
  )
  select case
    when normalized.email = '' then false
    else not exists (
      select 1
      from auth.users
      where lower(trim(email)) = normalized.email
    ) and not exists (
      select 1
      from public.profiles
      where lower(trim(email)) = normalized.email
    )
  end
  from normalized;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists papers_set_updated_at on public.papers;
create trigger papers_set_updated_at before update on public.papers for each row execute function public.set_updated_at();
drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at before update on public.questions for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.student_subjects enable row level security;
alter table public.exam_sessions enable row level security;
alter table public.papers enable row level security;
alter table public.questions enable row level security;
alter table public.topics enable row level security;
alter table public.question_topics enable row level security;
alter table public.bookmarks enable row level security;
alter table public.paper_views enable row level security;
alter table public.recent_question_views enable row level security;
alter table public.attempts enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create policy "subjects_public_read" on public.subjects for select using (true);
create policy "student_subjects_select_own" on public.student_subjects for select using (auth.uid() = student_id);
create policy "student_subjects_insert_own" on public.student_subjects for insert with check (auth.uid() = student_id);
create policy "student_subjects_delete_own" on public.student_subjects for delete using (auth.uid() = student_id);
create policy "sessions_public_read" on public.exam_sessions for select using (is_published = true);
create policy "papers_public_read" on public.papers for select using (is_published = true);
create policy "questions_public_read" on public.questions for select using (is_published = true);
create policy "topics_public_read" on public.topics for select using (true);
create policy "question_topics_public_read" on public.question_topics for select using (true);

create policy "bookmarks_select_own" on public.bookmarks for select using (auth.uid() = student_id);
create policy "bookmarks_insert_own" on public.bookmarks for insert with check (auth.uid() = student_id);
create policy "bookmarks_delete_own" on public.bookmarks for delete using (auth.uid() = student_id);

create policy "paper_views_select_own" on public.paper_views for select using (auth.uid() = student_id);
create policy "paper_views_insert_own" on public.paper_views for insert with check (auth.uid() = student_id);

create policy "recent_question_views_select_own" on public.recent_question_views for select using (auth.uid() = student_id);
create policy "recent_question_views_insert_own" on public.recent_question_views for insert with check (auth.uid() = student_id);

create policy "attempts_select_own" on public.attempts for select using (auth.uid() = student_id);
create policy "attempts_insert_own" on public.attempts for insert with check (auth.uid() = student_id);

create policy "subjects_admin_write" on public.subjects
for all
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "sessions_admin_write" on public.exam_sessions
for all
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "papers_admin_write" on public.papers
for all
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "questions_admin_write" on public.questions
for all
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "topics_admin_write" on public.topics
for all
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "question_topics_admin_write" on public.question_topics
for all
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

grant execute on function public.is_username_available(text) to anon, authenticated;
grant execute on function public.is_email_available(text) to anon, authenticated;
