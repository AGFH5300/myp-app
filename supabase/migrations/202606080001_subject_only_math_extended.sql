-- Treat Mathematics Extended as the subject/course identity in normal workflows.
-- This keeps legacy level columns/data available, preserves topic/question IDs, and is safe to rerun.
do $$
declare
  legacy_math_id uuid;
  math_extended_id uuid;
begin
  select id into legacy_math_id from public.subjects where name = 'Mathematics' limit 1;
  select id into math_extended_id from public.subjects where name = 'Mathematics Extended' limit 1;

  if math_extended_id is null then
    insert into public.subjects (name, code, description)
    values ('Mathematics Extended', 'MATH-EXT', 'MYP eAssessment Mathematics Extended papers and question records.')
    on conflict (code) do update
      set name = excluded.name,
          description = excluded.description
    returning id into math_extended_id;
  end if;

  if legacy_math_id is null or math_extended_id is null then
    return;
  end if;

  update public.topics
  set subject_id = math_extended_id,
      level = null
  where subject_id = legacy_math_id
    and level = 'Maths Extended';

  update public.papers
  set subject_id = math_extended_id
  where subject_id = legacy_math_id
    and level = 'Maths Extended';
end $$;
