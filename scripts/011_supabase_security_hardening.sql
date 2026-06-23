-- Forward-only, idempotent Supabase security hardening.
-- Mirrors the live database hardening without touching data.

create schema if not exists private;

do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'handle_new_user') then
    revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;
  end if;

  if to_regprocedure('public.is_admin(uuid)') is not null then
    revoke all on function public.is_admin(uuid) from public, anon, authenticated, service_role;
  end if;

  if to_regprocedure('public.is_admin()') is not null then
    revoke all on function public.is_admin() from public, anon, authenticated, service_role;
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

revoke all on function private.is_admin() from public, anon, authenticated, service_role;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' and new.role is distinct from 'student' then
      raise exception 'Users cannot create profiles with a privileged role';
    end if;

    if tg_op = 'UPDATE' and new.role is distinct from old.role then
      raise exception 'Users cannot change their own role';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_change on public.profiles;

create trigger profiles_prevent_role_change
before insert or update on public.profiles
for each row
execute function public.prevent_profile_role_change();

do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own') then
    alter policy "profiles_select_own" on public.profiles
    to authenticated
    using ((select auth.uid()) = id);
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_insert_own') then
    alter policy "profiles_insert_own" on public.profiles
    to authenticated
    with check ((select auth.uid()) = id);
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own') then
    alter policy "profiles_update_own" on public.profiles
    to authenticated
    using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);
  end if;
end $$;

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

do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subjects' and policyname = 'subjects_admin_write') then
    alter policy "subjects_admin_write" on public.subjects using (private.is_admin()) with check (private.is_admin());
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'exam_sessions' and policyname = 'sessions_admin_write') then
    alter policy "sessions_admin_write" on public.exam_sessions using (private.is_admin()) with check (private.is_admin());
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'papers' and policyname = 'papers_admin_write') then
    alter policy "papers_admin_write" on public.papers using (private.is_admin()) with check (private.is_admin());
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'questions' and policyname = 'questions_admin_write') then
    alter policy "questions_admin_write" on public.questions using (private.is_admin()) with check (private.is_admin());
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'topics' and policyname = 'topics_admin_write') then
    alter policy "topics_admin_write" on public.topics using (private.is_admin()) with check (private.is_admin());
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'question_topics' and policyname = 'question_topics_admin_write') then
    alter policy "question_topics_admin_write" on public.question_topics using (private.is_admin()) with check (private.is_admin());
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'resources' and policyname = 'resources_admin_manage') then
    alter policy "resources_admin_manage" on public.resources using (private.is_admin()) with check (private.is_admin());
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'resource_access_events' and policyname = 'resource_access_events_admin_read') then
    alter policy "resource_access_events_admin_read" on public.resource_access_events using (private.is_admin());
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_admin_read') then
    alter policy "profiles_admin_read" on public.profiles using (private.is_admin());
  end if;

  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'myp_resources_admin_manage') then
    alter policy "myp_resources_admin_manage" on storage.objects using (bucket_id = 'myp-resources' and private.is_admin()) with check (bucket_id = 'myp-resources' and private.is_admin());
  end if;
end $$;
