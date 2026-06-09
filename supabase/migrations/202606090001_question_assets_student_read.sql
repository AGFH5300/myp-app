-- Allow student-facing practice pages to list image assets for published questions.
-- Storage access remains signed-url based; this only exposes asset rows tied to published content.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'question_assets'
      and policyname = 'question_assets_read_published'
  ) then
    create policy "question_assets_read_published" on public.question_assets
    for select
    to anon, authenticated
    using (
      exists (
        select 1
        from public.questions q
        join public.papers p on p.id = q.paper_id
        where q.id = question_assets.question_id
          and q.is_published = true
          and p.is_published = true
      )
    );
  end if;
end
$$;
