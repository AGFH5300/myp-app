-- Harden signup duplicate protection across auth.users metadata and profiles.

create extension if not exists pgcrypto;

do $$
begin
  if exists (
    select 1
    from (
      select lower(trim(username)) as normalized_username, count(*)
      from public.profiles
      where username is not null and trim(username) <> ''
      group by lower(trim(username))
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'Cannot create profiles_username_lower_unique: duplicate normalized profile usernames exist. Run: select lower(trim(username)) as normalized_username, array_agg(id) as profile_ids from public.profiles where username is not null and trim(username) <> '''' group by lower(trim(username)) having count(*) > 1;';
  end if;

  if exists (
    select 1
    from (
      select lower(trim(email)) as normalized_email, count(*)
      from public.profiles
      where email is not null and trim(email) <> ''
      group by lower(trim(email))
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'Cannot create profiles_email_lower_unique: duplicate normalized profile emails exist. Run: select lower(trim(email)) as normalized_email, array_agg(id) as profile_ids from public.profiles where email is not null and trim(email) <> '''' group by lower(trim(email)) having count(*) > 1;';
  end if;
end $$;

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(trim(username)))
  where username is not null and trim(username) <> '';

create unique index if not exists profiles_email_lower_unique
  on public.profiles (lower(trim(email)))
  where email is not null and trim(email) <> '';

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

grant execute on function public.is_username_available(text) to anon, authenticated;
grant execute on function public.is_email_available(text) to anon, authenticated;

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
