-- Forward-only, idempotent Supabase security hardening.
-- Mirrors the live database hardening without touching data.

create schema if not exists private;

do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'handle_new_user') then
    revoke all on function public.handle_new_user() from public, anon, authenticated;
  end if;

  if to_regprocedure('public.is_admin(uuid)') is not null then
    revoke all on function public.is_admin(uuid) from public, anon, authenticated;
  end if;

  if to_regprocedure('public.is_admin()') is not null then
    revoke all on function public.is_admin() from public, anon, authenticated;
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

alter policy "profiles_select_own" on public.profiles
to authenticated
using (auth.uid() = id);

alter policy "profiles_insert_own" on public.profiles
to authenticated
with check (auth.uid() = id and coalesce(role, 'student') = 'student');

alter policy "profiles_update_own" on public.profiles
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id and coalesce(role, 'student') = 'student');

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname in ('public', 'storage')
      and policyname in (
        'subjects_admin_write', 'sessions_admin_write', 'papers_admin_write',
        'questions_admin_write', 'topics_admin_write', 'question_topics_admin_write',
        'resources_admin_manage', 'resource_access_events_admin_read', 'profiles_admin_read',
        'myp_resources_admin_manage'
      )
  loop
    execute format('alter policy %I on %I.%I to authenticated', policy_record.policyname, policy_record.schemaname, policy_record.tablename);
  end loop;
end $$;

alter policy "subjects_admin_write" on public.subjects using (private.is_admin()) with check (private.is_admin());
alter policy "sessions_admin_write" on public.exam_sessions using (private.is_admin()) with check (private.is_admin());
alter policy "papers_admin_write" on public.papers using (private.is_admin()) with check (private.is_admin());
alter policy "questions_admin_write" on public.questions using (private.is_admin()) with check (private.is_admin());
alter policy "topics_admin_write" on public.topics using (private.is_admin()) with check (private.is_admin());
alter policy "question_topics_admin_write" on public.question_topics using (private.is_admin()) with check (private.is_admin());

alter policy "resources_admin_manage" on public.resources using (private.is_admin()) with check (private.is_admin());
alter policy "resource_access_events_admin_read" on public.resource_access_events using (private.is_admin());
alter policy "profiles_admin_read" on public.profiles using (private.is_admin());
alter policy "myp_resources_admin_manage" on storage.objects using (bucket_id = 'myp-resources' and private.is_admin()) with check (bucket_id = 'myp-resources' and private.is_admin());
