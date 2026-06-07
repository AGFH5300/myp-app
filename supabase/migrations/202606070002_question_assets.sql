-- Store multiple uploaded crops for a single past-paper question while keeping
-- questions.question_image_path and questions.markscheme_image_path for legacy reads.

create table if not exists public.question_assets (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  asset_type text not null check (asset_type in ('question', 'markscheme')),
  storage_path text,
  public_url text,
  label text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint question_assets_has_asset check (storage_path is not null or public_url is not null)
);

create index if not exists question_assets_question_type_order_idx
  on public.question_assets(question_id, asset_type, sort_order, created_at);

alter table public.question_assets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'question_assets'
      and policyname = 'question_assets_admin_manage'
  ) then
    create policy "question_assets_admin_manage" on public.question_assets
    for all
    to authenticated
    using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
    with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
  end if;
end
$$;
