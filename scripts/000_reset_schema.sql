-- MYP Atlas Phase 1 reset
-- Drops project objects in dependency-safe order.

begin;

-- Drop RLS policies first.
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles','subjects','student_subjects','exam_sessions','papers','questions','topics','question_topics',
        'bookmarks','paper_views','recent_question_views','attempts'
      )
  loop
    execute format('drop policy if exists %I on %I.%I;', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- Drop triggers tied to auth and app tables.
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists profiles_set_updated_at on public.profiles;
drop trigger if exists papers_set_updated_at on public.papers;
drop trigger if exists questions_set_updated_at on public.questions;

-- Drop functions.
drop function if exists public.handle_new_user();
drop function if exists public.set_updated_at();

-- Drop views if present.
drop view if exists public.published_questions cascade;
drop view if exists public.published_papers cascade;

-- Drop tables.
drop table if exists public.attempts cascade;
drop table if exists public.recent_question_views cascade;
drop table if exists public.paper_views cascade;
drop table if exists public.bookmarks cascade;
drop table if exists public.question_topics cascade;
drop table if exists public.topics cascade;
drop table if exists public.questions cascade;
drop table if exists public.papers cascade;
drop table if exists public.exam_sessions cascade;
drop table if exists public.student_subjects cascade;
drop table if exists public.subjects cascade;
drop table if exists public.profiles cascade;

commit;
