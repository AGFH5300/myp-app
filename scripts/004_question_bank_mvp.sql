-- MYP Atlas topic-based past paper question bank MVP.
-- Adds only the missing fields needed to manage individual past paper questions.

alter table public.papers
  add column if not exists level text,
  add column if not exists session text,
  add column if not exists source_pdf_path text,
  add column if not exists markscheme_pdf_path text;

alter table public.questions
  add column if not exists question_order integer,
  add column if not exists context_image_url text,
  add column if not exists secondary_image_url text,
  add column if not exists markscheme_image_url text,
  add column if not exists question_image_path text,
  add column if not exists markscheme_image_path text,
  add column if not exists is_reviewed boolean not null default false;

alter table public.question_topics
  add column if not exists is_primary boolean not null default false,
  add column if not exists confidence text;

create index if not exists idx_papers_subject_level on public.papers(subject_id, level);
create index if not exists idx_questions_paper_order on public.questions(paper_id, question_order, question_number);
create index if not exists idx_question_topics_topic on public.question_topics(topic_id);

insert into storage.buckets (id, name, public)
values ('question-assets', 'question-assets', false)
on conflict (id) do update set public = false;

create policy "question_assets_read_signed" on storage.objects
for select
to anon, authenticated
using (bucket_id = 'question-assets');

create policy "question_assets_admin_manage" on storage.objects
for all
to authenticated
using (
  bucket_id = 'question-assets'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
)
with check (
  bucket_id = 'question-assets'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Safe placeholder seed: no real copyrighted past paper content is stored here.
insert into public.subjects (name, code, description)
values ('Mathematics', 'MATH', 'MYP eAssessment Mathematics papers and question records.')
on conflict (code) do update set description = excluded.description;

insert into public.exam_sessions (session_month, session_year, is_published)
values ('May', 2025, true)
on conflict (session_month, session_year) do update set is_published = excluded.is_published;

insert into public.topics (name) values
  ('Number'),
  ('Algebra'),
  ('Functions'),
  ('Geometry and trigonometry'),
  ('Statistics and probability')
on conflict (name) do nothing;

with math as (
  select id as subject_id from public.subjects where code = 'MATH'
), may2025 as (
  select id as exam_session_id from public.exam_sessions where session_month = 'May' and session_year = 2025
)
insert into public.papers (
  subject_id, exam_session_id, title, year, level, session, paper_code,
  is_published, source_notes
)
select
  math.subject_id,
  may2025.exam_session_id,
  'Mathematics Extended placeholder paper',
  2025,
  'Maths Extended',
  'May',
  'MATH-EXT-PLACEHOLDER-2025-MAY',
  true,
  'Placeholder paper for manual question-bank testing. Replace with licensed source paths in admin.'
from math, may2025
on conflict do nothing;

with paper as (
  select id from public.papers where paper_code = 'MATH-EXT-PLACEHOLDER-2025-MAY' limit 1
)
insert into public.questions (
  paper_id, question_number, question_order, prompt_text, marks, markscheme_text,
  is_published, is_reviewed
)
select paper.id, q.question_number, q.question_order, q.prompt_text, q.marks, q.markscheme_text, q.is_published, true
from paper,
(
  values
    ('1', 1, 'Placeholder question prompt. Add your own licensed question image or text in admin.', 4, 'Placeholder mark scheme. Replace with licensed mark scheme content or image path.', true),
    ('2', 2, 'Draft placeholder question. It should stay hidden until published.', 3, 'Draft placeholder mark scheme.', false)
) as q(question_number, question_order, prompt_text, marks, markscheme_text, is_published)
on conflict (paper_id, question_number) do update
set
  question_order = excluded.question_order,
  prompt_text = excluded.prompt_text,
  marks = excluded.marks,
  markscheme_text = excluded.markscheme_text,
  is_published = excluded.is_published,
  is_reviewed = excluded.is_reviewed;

insert into public.question_topics (question_id, topic_id, is_primary, confidence)
select q.id, t.id, true, 'manual'
from public.questions q
join public.papers p on p.id = q.paper_id
join public.topics t on t.name = 'Algebra'
where p.paper_code = 'MATH-EXT-PLACEHOLDER-2025-MAY' and q.question_number = '1'
on conflict (question_id, topic_id) do update
set is_primary = excluded.is_primary, confidence = excluded.confidence;
