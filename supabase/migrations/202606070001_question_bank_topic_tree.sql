-- Extend broad topic tags into an optional scoped topic tree for past-paper questions.
alter table public.topics add column if not exists subject_id uuid null references public.subjects(id);
alter table public.topics add column if not exists parent_topic_id uuid null references public.topics(id) on delete cascade;
alter table public.topics add column if not exists level text null;
alter table public.topics add column if not exists slug text;
alter table public.topics add column if not exists sort_order integer default 0;
alter table public.topics add column if not exists is_active boolean default true;

update public.topics
set slug = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))
where slug is null;

create index if not exists topics_subject_level_idx on public.topics(subject_id, level) where is_active = true;
create index if not exists topics_parent_topic_idx on public.topics(parent_topic_id, sort_order) where is_active = true;
create index if not exists topics_slug_idx on public.topics(slug);

do $$
declare
  maths_subject_id uuid;
  group_id uuid;
  item record;
  group_names text[] := array[
    'Number',
    'Algebra',
    'Functions',
    'Geometry and trigonometry',
    'Statistics and probability'
  ];
begin
  select id into maths_subject_id from public.subjects where name = 'Mathematics' limit 1;
  if maths_subject_id is null then
    return;
  end if;

  for i in 1..array_length(group_names, 1) loop
    select id into group_id
    from public.topics
    where name = group_names[i]
      and parent_topic_id is null
      and (subject_id = maths_subject_id or subject_id is null)
    limit 1;

    if group_id is null then
      insert into public.topics(name, subject_id, level, slug, sort_order, is_active)
      values (
        group_names[i],
        maths_subject_id,
        'Maths Extended',
        lower(regexp_replace(group_names[i], '[^a-zA-Z0-9]+', '-', 'g')),
        i * 10,
        true
      )
      returning id into group_id;
    else
      update public.topics
      set slug = coalesce(slug, lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))),
          sort_order = coalesce(sort_order, i * 10),
          is_active = coalesce(is_active, true)
      where id = group_id;
    end if;
  end loop;

  for item in
    select * from (values
      ('Algebra', 'Linear equations', 10),
      ('Algebra', 'Inequalities and feasible regions', 20),
      ('Algebra', 'Sequences', 30),
      ('Algebra', 'Simultaneous equations', 40),
      ('Algebra', 'Quadratics', 50),
      ('Algebra', 'Exponents and indices', 60),
      ('Functions', 'Linear functions', 10),
      ('Functions', 'Quadratic functions', 20),
      ('Functions', 'Graph interpretation', 30),
      ('Functions', 'Transformations', 40),
      ('Geometry and trigonometry', 'Angles and polygons', 10),
      ('Geometry and trigonometry', 'Coordinate geometry', 20),
      ('Geometry and trigonometry', 'Trigonometry', 30),
      ('Geometry and trigonometry', 'Area and volume', 40),
      ('Statistics and probability', 'Averages and spread', 10),
      ('Statistics and probability', 'Probability', 20),
      ('Statistics and probability', 'Venn diagrams', 30),
      ('Statistics and probability', 'Data representation', 40)
    ) as seed(parent_name, child_name, child_order)
  loop
    select id into group_id
    from public.topics
    where name = item.parent_name
      and parent_topic_id is null
      and (subject_id = maths_subject_id or subject_id is null)
    limit 1;

    if group_id is not null and not exists (
      select 1 from public.topics where parent_topic_id = group_id and name = item.child_name
    ) then
      insert into public.topics(name, subject_id, parent_topic_id, level, slug, sort_order, is_active)
      values (
        item.child_name,
        maths_subject_id,
        group_id,
        'Maths Extended',
        lower(regexp_replace(item.child_name, '[^a-zA-Z0-9]+', '-', 'g')),
        item.child_order,
        true
      );
    end if;
  end loop;
end $$;
