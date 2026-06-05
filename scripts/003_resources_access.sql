-- MYP Atlas public resource browsing with authenticated, logged file access.
-- Run this after the base schema. It does not touch the existing exam-files bucket.

create extension if not exists pgcrypto;

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  category text,
  description text,
  file_path text not null,
  file_type text,
  source_label text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resource_access_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  resource_id uuid references public.resources(id) on delete set null,
  action text not null check (action in ('open', 'download')),
  created_at timestamptz not null default now()
);

create index if not exists idx_resources_published_subject_category on public.resources(is_published, subject, category, title);
create index if not exists idx_resource_access_events_created_at on public.resource_access_events(created_at desc);
create index if not exists idx_resource_access_events_user on public.resource_access_events(user_id, created_at desc);
create index if not exists idx_resource_access_events_resource on public.resource_access_events(resource_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

drop trigger if exists resources_set_updated_at on public.resources;
create trigger resources_set_updated_at before update on public.resources for each row execute function public.set_updated_at();

alter table public.resources enable row level security;
alter table public.resource_access_events enable row level security;

create policy "resources_public_read_published" on public.resources
for select
using (is_published = true);

create policy "resources_admin_manage" on public.resources
for all
using (public.is_admin())
with check (public.is_admin());

create policy "resource_access_events_insert_own" on public.resource_access_events
for insert
with check (auth.uid() = user_id);

create policy "resource_access_events_select_own" on public.resource_access_events
for select
using (auth.uid() = user_id);

create policy "resource_access_events_admin_read" on public.resource_access_events
for select
using (public.is_admin());

-- Allows admin analytics to show names/emails for access events.
create policy "profiles_admin_read" on public.profiles
for select
using (public.is_admin());

insert into storage.buckets (id, name, public)
values ('myp-resources', 'myp-resources', false)
on conflict (id) do update set public = false;

create policy "myp_resources_authenticated_read" on storage.objects
for select
to authenticated
using (bucket_id = 'myp-resources');

create policy "myp_resources_admin_manage" on storage.objects
for all
to authenticated
using (
  bucket_id = 'myp-resources'
  and public.is_admin()
)
with check (
  bucket_id = 'myp-resources'
  and public.is_admin()
);

grant execute on function public.is_admin() to authenticated;
