-- MYP eAssessment Platform Database Schema

-- Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text default 'student' check (role in ('student', 'teacher', 'admin')),
  grade_level integer check (grade_level between 1 and 5),
  school_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Subjects table (MYP subject groups)
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,
  description text,
  color text default '#3b82f6',
  icon text,
  created_at timestamptz default now()
);

-- Papers table (exam papers for each subject)
create table if not exists public.papers (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.subjects(id) on delete cascade,
  title text not null,
  year integer not null,
  session text check (session in ('May', 'November')),
  timezone text check (timezone in ('TZ1', 'TZ2')),
  paper_number integer default 1,
  duration_minutes integer default 60,
  total_marks integer default 100,
  description text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Questions table
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid references public.papers(id) on delete cascade,
  question_number text not null,
  question_text text not null,
  question_type text default 'short_answer' check (question_type in ('multiple_choice', 'short_answer', 'extended_response', 'structured')),
  marks integer default 1,
  command_term text,
  criterion text check (criterion in ('A', 'B', 'C', 'D')),
  strand text,
  image_url text,
  options jsonb, -- for multiple choice questions
  correct_answer text,
  mark_scheme text,
  order_index integer default 0,
  created_at timestamptz default now()
);

-- Student attempts table
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  paper_id uuid references public.papers(id) on delete cascade,
  started_at timestamptz default now(),
  completed_at timestamptz,
  time_spent_seconds integer default 0,
  total_score integer,
  max_score integer,
  percentage numeric(5,2),
  status text default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  created_at timestamptz default now()
);

-- Question responses table
create table if not exists public.question_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references public.attempts(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  user_answer text,
  is_correct boolean,
  marks_awarded integer default 0,
  time_spent_seconds integer default 0,
  flagged boolean default false,
  created_at timestamptz default now(),
  unique(attempt_id, question_id)
);

-- Student progress tracking
create table if not exists public.student_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  total_questions_attempted integer default 0,
  total_questions_correct integer default 0,
  total_time_spent_seconds integer default 0,
  last_activity_at timestamptz default now(),
  criterion_a_score numeric(5,2) default 0,
  criterion_b_score numeric(5,2) default 0,
  criterion_c_score numeric(5,2) default 0,
  criterion_d_score numeric(5,2) default 0,
  updated_at timestamptz default now(),
  unique(user_id, subject_id)
);

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.papers enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;
alter table public.question_responses enable row level security;
alter table public.student_progress enable row level security;

-- RLS Policies for profiles
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- RLS Policies for subjects (everyone can read)
create policy "Anyone can view subjects" on public.subjects for select using (true);

-- RLS Policies for papers (everyone can read active papers)
create policy "Anyone can view active papers" on public.papers for select using (is_active = true);

-- RLS Policies for questions (everyone can read)
create policy "Anyone can view questions" on public.questions for select using (true);

-- RLS Policies for attempts
create policy "Users can view own attempts" on public.attempts for select using (auth.uid() = user_id);
create policy "Users can create own attempts" on public.attempts for insert with check (auth.uid() = user_id);
create policy "Users can update own attempts" on public.attempts for update using (auth.uid() = user_id);

-- RLS Policies for question_responses
create policy "Users can view own responses" on public.question_responses for select 
  using (attempt_id in (select id from public.attempts where user_id = auth.uid()));
create policy "Users can create own responses" on public.question_responses for insert 
  with check (attempt_id in (select id from public.attempts where user_id = auth.uid()));
create policy "Users can update own responses" on public.question_responses for update 
  using (attempt_id in (select id from public.attempts where user_id = auth.uid()));

-- RLS Policies for student_progress
create policy "Users can view own progress" on public.student_progress for select using (auth.uid() = user_id);
create policy "Users can upsert own progress" on public.student_progress for insert with check (auth.uid() = user_id);
create policy "Users can update own progress" on public.student_progress for update using (auth.uid() = user_id);

-- Function to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'student')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger to create profile on user signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
